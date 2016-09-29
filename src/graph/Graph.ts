/// <reference path="../../typings/index.d.ts" />

import {Observable} from "rxjs/Observable";
import {Subject} from "rxjs/Subject";

import * as _ from "underscore";
import * as graphlib from "graphlib";
import * as rbush from "rbush";
import * as THREE from "three";
import * as geohash from "latlon-geohash";

import {APIv3, IAPINavIm, IAPINavImIm, IFillNode, IFullNode} from "../API";
import {IEdge, IPotentialEdge, IEdgeData, EdgeCalculator, EdgeDirection} from "../Edge";
import {Spatial, GeoCoords, ILatLon} from "../Geo";
import {NewNode, Node, Sequence} from "../Graph";

interface INewSpatialItem {
    lat: number;
    lon: number;
    node: NewNode;
}

export class NewGraph {
    private _apiV3: APIv3;
    private _nodeIndex: rbush.RBush<ISpatialItem>;
    private _graph: graphlib.Graph<NewNode, IEdgeData>;

    private _fetching: { [key: string]: boolean };
    private _filling: { [key: string]: boolean };

    private _changed$: Subject<NewGraph>;

    constructor(apiV3: APIv3, nodeIndex?: rbush.RBush<ISpatialItem>, graph?: graphlib.Graph<NewNode, IEdgeData>) {
        this._apiV3 = apiV3;
        this._nodeIndex = nodeIndex != null ? nodeIndex : rbush<ISpatialItem>(16, [".lon", ".lat", ".lon", ".lat"]);
        this._graph = graph != null ? graph : new graphlib.Graph<NewNode, IEdgeData>({ multigraph: true });

        this._fetching = {};
        this._filling = {};

        this._changed$ = new Subject<NewGraph>();
    }

    public get changed$(): Observable<NewGraph> {
        return this._changed$;
    }

    public hasNode(key: string): boolean {
        return this._graph.hasNode(key);
    }

    public getNode(key: string): NewNode {
        return this._graph.node(key);
    }

    public fetching(key: string): boolean {
        return key in this._fetching;
    }

    public filling(key: string): boolean {
        return key in this._filling;
    }

    public fetch(key: string): void {
        if (key in this._fetching) {
            throw new Error(`Already fetching (${key}).`);
        }

        if (this._graph.hasNode(key)) {
            throw new Error(`Cannot fetch node that already exist in graph (${key}).`);
        }

        this._fetching[key] = true;
        this._apiV3.imageByKeyFull([key])
            .then(
                (res: any): void => {
                    let fn: IFullNode = <IFullNode>res.json.imageByKey[key];
                    let node: NewNode = new NewNode(fn, "");
                    node.makeFull(fn);

                    this._graph.setNode(node.key, node);

                    delete this._fetching[key];
                    this._changed$.next(this);
                });
    }

    public fill(key: string): void {
        if (key in this._fetching) {
            throw new Error(`Cannot fill node while fetching (${key}).`);
        }

        if (key in this._filling) {
            throw new Error(`Already filling (${key}).`);
        }

        if (!this._graph.hasNode(key)) {
            throw new Error(`Cannot fill node that does not exist in graph (${key}).`);
        }

        let node: NewNode = this._graph.node(key);
        if (node.fill != null) {
            throw new Error(`Cannot fill node that is already filled (${key}).`);
        }

        this._filling[key] = true;
        this._apiV3.imageByKeyFill([key])
            .then(
                (res: any): void => {
                    delete this._filling[key];

                    if (node.fill != null) {
                        return;
                    }

                    node.makeFull(<IFillNode>res.json.imageByKey[key]);
                    this._changed$.next(this);
                });
    }
}

class GeoHashDirections {
    public static n: string = "n";
    public static nw: string = "nw";
    public static w: string = "w";
    public static sw: string = "sw";
    public static s: string = "s";
    public static se: string = "se";
    public static e: string = "e";
    public static ne: string = "ne";
}

interface ISpatialItem {
    lat: number;
    lon: number;
    node: Node;
}

type SequenceHash = {[key: string]: Sequence};

export class Graph {
    private _edgeCalculator: EdgeCalculator;

    private _sequences: SequenceHash;
    private _sequenceHashes: {[skey: string]: SequenceHash};

    private _graph: graphlib.Graph<Node, IEdgeData>;
    private _nodeIndex: rbush.RBush<ISpatialItem>;

    private _unWorthyNodes: {[key: string]: boolean};

    private _boxWidth: number = 0.001;
    private _defaultAlt: number = 2;

    private _spatial: Spatial;
    private _geoCoords: GeoCoords;

    /**
     * Creates a graph instance
     * @class Graph
     */
    constructor () {
        this._sequences = {};
        this._sequenceHashes = {};
        this._nodeIndex = rbush<ISpatialItem>(16, [".lon", ".lat", ".lon", ".lat"]);
        this._graph = new graphlib.Graph<Node, IEdgeData>({ multigraph: true });
        this._unWorthyNodes = {};
        this._edgeCalculator = new EdgeCalculator();
        this._spatial = new Spatial();
        this._geoCoords = new GeoCoords();
    }

    /**
     * Add nodes from an API call
     * @param {IAPINavIm} data - Image tile
     */
    public addNodesFromAPI(data: IAPINavIm, tiles: {[key: string]: boolean}): void {
        if (data === undefined) {
            return;
        }

        let h: string = data.hs[0];
        let bounds: geohash.IBounds = geohash.bounds(h);
        let neighbours: { [key: string]: string } = geohash.neighbours(h);

        let hSequenceHashes: SequenceHash[] = [];

        for (let s of data.ss) {
            let skey: string = s.key;

            if (skey in this._sequences) {
                hSequenceHashes.push(this._sequenceHashes[skey]);
                continue;
            }

            let sequence: Sequence = new Sequence(s);
            this._sequences[skey] = sequence;

            let sequenceHash: SequenceHash = {};
            for (let key of s.keys) {
                sequenceHash[key] = sequence;
            }

            this._sequenceHashes[skey] = sequenceHash;
            hSequenceHashes.push(sequenceHash);
        }

        let nodes: Node[] = _.map(data.ims, (im: IAPINavImIm): Node => {
            let lat: number = im.lat;
            if (im.clat != null) {
                lat = im.clat;
            }

            let lon: number = im.lon;
            if (im.clon != null) {
                lon = im.clon;
            }

            let ca: number = im.ca;
            if (im.cca != null) {
                ca = im.cca;
            }

            if (im.calt == null) {
                im.calt = this._defaultAlt;
            }

            let latLon: ILatLon = {lat: lat, lon: lon};

            if (im.rotation == null) {
                im.rotation = this._computeRotation(im.ca, im.orientation);
            }

            let hs: string[] = this._computeHs(latLon, bounds.sw, bounds.ne, h, neighbours);

            let sequence: Sequence = null;
            for (let ts of hSequenceHashes) {
                if (im.key in ts) {
                    sequence = ts[im.key];
                    break;
                }
            }

            let node: Node = new Node(ca, latLon, false, sequence, im, hs);

            this._unWorthyNodes[im.key] = true;

            return node;
        });

        this._insertNodes(nodes);
        this._makeNodesWorthy(tiles);
    }

    /**
     * Get node from valid `key`
     * @param {string} key - valid Mapillary photo key
     * @return {Node}
     */
    public getNode(key: string): Node {
        return this._graph.node(key);
    }

    /**
     * Get edges for the given node
     * @param {Node} node - The node
     * @return {IEdge}
     */
    public getEdges(node: Node): IEdge[] {
        let outEdges: graphlib.Edge[] = this._graph.outEdges(node.key);

        return _.map(outEdges, (outEdge: graphlib.Edge) => {
            let data: IEdgeData = this._graph.edge(outEdge);

            return {
                data: data,
                from: outEdge.v,
                to: outEdge.w,
            };
        });
    }

    /**
     * Cache given node
     * @param {Node} node - Node to be cached
     */
    public cacheNode(node: Node): void {
        if (this._computeEdges(node)) {
            node.cacheEdges(this.getEdges(node));
        }
    }

    /**
     * Find next node in the graph
     * @param {Node} node
     * @param {Direction} dir
     * @return {Node}
     */
    public nextNode(node: Node, dir: EdgeDirection): Node {
        let key: string = this.nextKey(node, dir);

        return key == null ? null : this.getNode(key);
    }

    public nextKey(node: Node, dir: EdgeDirection): string {
        let outEdges: graphlib.Edge[] = this._graph.outEdges(node.key);

        for (let outEdge of outEdges) {
            let edgeData: IEdgeData = this._graph.edge(outEdge);

            if (edgeData.direction === dir) {
                return outEdge.w;
            }
        }

        return null;
    }

    /**
     * Add edges to given node
     * @param {Node} node
     * @param {IEdge[]} edges
     */
    private _addEdgesToNode(node: Node, edges: IEdge[]): void {
        let outEdges: graphlib.Edge[] = this._graph.outEdges(node.key);

        for (let outEdge of outEdges) {
            this._graph.removeEdge(outEdge);
        }

        for (let edge of edges) {
            this._graph.setEdge(node.key, edge.to, edge.data, node.key + edge.to + edge.data.direction);
        }
    }

    /**
     * Compute edges for the given node
     * @param {Node} node
     * @return {boolean}
     */
    private _computeEdges(node: Node): boolean {
        if (!node.worthy) {
            return false;
        }

        let edges: IEdge[] = this._edgeCalculator.computeSequenceEdges(node);
        let fallbackKeys: string[] = _.map(edges, (edge: IEdge) => { return edge.to; });

        let minLon: number = node.latLon.lon - this._boxWidth / 2;
        let minLat: number = node.latLon.lat - this._boxWidth / 2;

        let maxLon: number = node.latLon.lon + this._boxWidth / 2;
        let maxLat: number = node.latLon.lat + this._boxWidth / 2;

        let nodes: Node[] = _.map(
            this._nodeIndex.search({ maxX: maxLon, maxY: maxLat, minX: minLon, minY: minLat }),
            (item: ISpatialItem) => {
                return item.node;
            });

        let potentialEdges: IPotentialEdge[] = this._edgeCalculator.getPotentialEdges(node, nodes, fallbackKeys);

        edges = edges.concat(
            this._edgeCalculator.computeStepEdges(
                node,
                potentialEdges,
                node.findPrevKeyInSequence(),
                node.findNextKeyInSequence()));

        edges = edges.concat(this._edgeCalculator.computeTurnEdges(node, potentialEdges));
        edges = edges.concat(this._edgeCalculator.computePanoEdges(node, potentialEdges));
        edges = edges.concat(this._edgeCalculator.computePerspectiveToPanoEdges(node, potentialEdges));
        edges = edges.concat(this._edgeCalculator.computeSimilarEdges(node, potentialEdges));

        this._addEdgesToNode(node, edges);

        return true;
    }

    private _computeHs(
        latLon: ILatLon,
        sw: ILatLon,
        ne: ILatLon,
        h: string,
        neighbours: { [key: string]: string }): string[] {

        let hs: string[] = [h];

        let bl: number[] = [0, 0, 0];
        let tr: number[] =
            this._geoCoords.geodeticToEnu(
                ne.lat,
                ne.lon,
                0,
                sw.lat,
                sw.lon,
                0);

        let position: number[] =
            this._geoCoords.geodeticToEnu(
                latLon.lat,
                latLon.lon,
                0,
                sw.lat,
                sw.lon,
                0);

        let left: number = position[0] - bl[0];
        let right: number = tr[0] - position[0];
        let bottom: number = position[1] - bl[1];
        let top: number = tr[1] - position[1];

        let l: boolean = left < 20;
        let r: boolean = right < 20;
        let b: boolean = bottom < 20;
        let t: boolean = top < 20;

        if (t) {
            hs.push(neighbours[GeoHashDirections.n]);
        }

        if (t && l) {
            hs.push(neighbours[GeoHashDirections.nw]);
        }

        if (l) {
            hs.push(neighbours[GeoHashDirections.w]);
        }

        if (l && b) {
            hs.push(neighbours[GeoHashDirections.sw]);
        }

        if (b) {
            hs.push(neighbours[GeoHashDirections.s]);
        }

        if (b && r) {
            hs.push(neighbours[GeoHashDirections.se]);
        }

        if (r) {
            hs.push(neighbours[GeoHashDirections.e]);
        }

        if (r && t) {
            hs.push(neighbours[GeoHashDirections.ne]);
        }

        return hs;
    }

    /**
     * Compute rotation
     * @param {number} compassAngle
     * @return {Array<number>}
     */
    private _computeRotation(compassAngle: number, orientation: number): number[] {
        let x: number = 0;
        let y: number = 0;
        let z: number = 0;

        switch (orientation) {
            case 1:
                x = Math.PI / 2;
                break;
            case 3:
                x = -Math.PI / 2;
                z = Math.PI;
                break;
            case 6:
                y = -Math.PI / 2;
                z = -Math.PI / 2;
                break;
            case 8:
                y = Math.PI / 2;
                z = Math.PI / 2;
                break;
            default:
                break;
        }

        let rz: THREE.Matrix4 = new THREE.Matrix4().makeRotationZ(z);
        let euler: THREE.Euler = new THREE.Euler(x, y, compassAngle * Math.PI / 180, "XYZ");
        let re: THREE.Matrix4 = new THREE.Matrix4().makeRotationFromEuler(euler);

        let rotation: THREE.Vector4 = new THREE.Vector4().setAxisAngleFromRotationMatrix(re.multiply(rz));

        return rotation.multiplyScalar(rotation.w).toArray().slice(0, 3);
    }

    /**
     * Insert given nodes
     * @param {Node[]}
     */
    private _insertNodes(nodes: Node[]): void {
        _.each(nodes, (node: Node) => {
            this._insertNode(node);
        });
    }

    /**
     * Insert node
     * @param {Node} node
     */
    private _insertNode(node: Node): void {
        if (this.getNode(node.key) != null) {
            return;
        }

        this._nodeIndex.insert({ lat: node.latLon.lat, lon: node.latLon.lon, node: node });
        this._graph.setNode(node.key, node);
    }

    private _makeNodesWorthy(tiles: {[key: string]: boolean}): void {
        let worthy: boolean;
        let worthyKeys: string[] = [];
        for (let key in this._unWorthyNodes) {
            if (!this._unWorthyNodes.hasOwnProperty(key)) {
                continue;
            }

            if (!this._unWorthyNodes[key]) {
                worthyKeys.push(key);
                continue;
            }

            let node: Node = this.getNode(key);
            let hs: string[] = node.hs;

            worthy = true;
            _.each(hs, (h: string): void => {
                worthy = worthy && !!tiles[h];
            });

            if (worthy) {
                node.makeWorthy();
                this._unWorthyNodes[key] = false;
                worthyKeys.push(key);
            }
        }

        for (let key of worthyKeys) {
            delete this._unWorthyNodes[key];
        }
    }
}

export default Graph;
