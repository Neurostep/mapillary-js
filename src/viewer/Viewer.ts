/// <reference path="../../typings/index.d.ts" />

import * as when from "when";

import {EdgeDirection} from "../Edge";
import {
    FilterExpression,
    Node,
} from "../Graph";
import {
    ComponentController,
    Container,
    EventLauncher,
    IViewerOptions,
    Navigator,
} from "../Viewer";
import {
    Component,
    IComponentConfiguration,
} from "../Component";
import {
    EventEmitter,
    Settings,
} from "../Utils";
import {RenderMode} from "../Render";

/**
 * @class Viewer
 *
 * @classdesc The Viewer object represents the navigable photo viewer.
 * Create a Viewer by specifying a container, client ID, photo key and
 * other options. The viewer exposes methods and events for programmatic
 * interaction.
 */
export class Viewer extends EventEmitter {
    /**
     * Fired when the viewing direction of the camera changes.
     * @event
     * @type {boolean} bearing - Value indicating the current bearing
     * measured in degrees clockwise with respect to north.
     */
    public static bearingchanged: string = "bearingchanged";

    /**
     * Fired when the viewer is loading more data.
     * @event
     * @type {boolean} loading - Value indicating whether the viewer is loading.
     */
    public static loadingchanged: string = "loadingchanged";

    /**
     * Fired when the viewer finishes transitioning and is in a fixed
     * position with a fixed point of view.
     * @event
     */
    public static moveend: string = "moveend";

    /**
     * Fired when the viewer starts transitioning from one view to another,
     * either by changing the node or by interaction such as pan and zoom.
     * @event
     */
    public static movestart: string = "movestart";

    /**
     * Fired every time the viewer navigates to a new node.
     * @event
     * @type {Node} node - Current node.
     */
    public static nodechanged: string = "nodechanged";

    /**
     * Fired every time the sequence edges of the current node changes.
     * @event
     * @type {IEdgeStatus} status - The edge status object.
     */
    public static sequenceedgeschanged: string = "sequenceedgeschanged";

    /**
     * Fired every time the spatial edges of the current node changes.
     * @event
     * @type {IEdgeStatus} status - The edge status object.
     */
    public static spatialedgeschanged: string = "spatialedgeschanged";

    /**
     * Private ComponentController object which manages component states.
     */
    private _componentController: ComponentController;

    /**
     * Private Container object which maintains the DOM Element,
     * renderers and relevant services.
     */
    private _container: Container;

    /**
     * Private EventLauncher object which fires events on behalf of
     * the viewer.
     */
    private _eventLauncher: EventLauncher;

    /**
     * Private Navigator object which controls navigation throught
     * the vast seas of Mapillary.
     */
    private _navigator: Navigator;

    /**
     * Create a new viewer instance.
     *
     * @param {string} id - Required `id` of a DOM element which will
     * be transformed into the viewer.
     * @param {string} clientId - Required `Mapillary API ClientID`. Can
     * be obtained from https://www.mapillary.com/app/settings/developers.
     * @param {string} [key] - Optional `photoId` to start from, can be any
     * Mapillary photo, if null no image is loaded.
     * @param {IViewerOptions} [options] - Optional configuration object
     * specifing Viewer's initial setup.
     * @param {string} [token] - Optional bearer token for API requests of
     * protected resources.
     */
    constructor (id: string, clientId: string, key?: string, options?: IViewerOptions, token?: string) {
        super();

        options = options != null ? options : {};

        Settings.setOptions(options);

        this._navigator = new Navigator(clientId, token);
        this._container = new Container(id, this._navigator.stateService, options);
        this._eventLauncher = new EventLauncher(this, this._navigator, this._container);
        this._componentController = new ComponentController(this._container, this._navigator, key, options.component);
    }

    /**
     * Activate a component.
     *
     * @param {string} name - Name of the component which will become active.
     */
    public activateComponent(name: string): void {
        this._componentController.activate(name);
    }

    /**
     * Activate the cover (deactivates all other components).
     */
    public activateCover(): void {
        this._componentController.activateCover();
    }

    /**
     * Deactivate a component.
     *
     * @param {string} name - Name of component which become inactive.
     */
    public deactivateComponent(name: string): void {
        this._componentController.deactivate(name);
    }

    /**
     * Deactivate the cover (activates all components marked as active).
     */
    public deactivateCover(): void {
        this._componentController.deactivateCover();
    }

    /**
     * Get the bearing of the current viewer camera.
     *
     * @description The bearing depends on how the camera
     * is currently rotated and does not correspond
     * to the compass angle of the current node if the view
     * has been panned.
     *
     * Bearing is measured in degrees clockwise with respect to
     * north.
     *
     * @returns {Promise<number>} Promise to the bearing
     * of the current viewer camera.
     */
    public getBearing(): when.Promise<number> {
        return when.promise<number>(
            (resolve: any, reject: any): void => {
                this._container.renderService.bearing$
                    .first()
                    .subscribe(
                        (bearing: number): void => {
                            resolve(bearing);
                        },
                        (error: Error): void => {
                            reject(error);
                        });
            });
    }

    /**
     * Get the basic coordinates of the current photo that is
     * at the center of the viewport.
     *
     * @description Basic coordinates are 2D coordinates on the [0, 1] interval
     * and have the origin point, (0, 0), at the top left corner and the
     * maximum value, (1, 1), at the bottom right corner of the original
     * photo.
     *
     * @returns {Promise<number[]>} Promise to the basic coordinates
     * of the current photo at the center for the viewport.
     */
    public getCenter(): when.Promise<number[]> {
        return when.promise<number[]>(
            (resolve: any, reject: any): void => {
                this._navigator.stateService.getCenter()
                    .subscribe(
                        (center: number[]): void => {
                            resolve(center);
                        },
                        (error: Error): void => {
                            reject(error);
                        });
            });
    }

    /**
     * Get a component.
     *
     * @param {string} name - Name of component.
     * @returns {Component} The requested component.
     */
    public getComponent<TComponent extends Component<IComponentConfiguration>>(name: string): TComponent {
        return this._componentController.get<TComponent>(name);
    }

    /**
     * Get the photo's current zoom level.
     *
     * @returns {Promise<number>} Promise to the viewers's current
     * zoom level.
     */
    public getZoom(): when.Promise<number> {
         return when.promise<number>(
            (resolve: any, reject: any): void => {
                this._navigator.stateService.getZoom()
                    .subscribe(
                        (zoom: number): void => {
                            resolve(zoom);
                        },
                        (error: Error): void => {
                            reject(error);
                        });
            });
    }

    /**
     * Move close to given latitude and longitude.
     *
     * @param {Number} lat - Latitude, in degrees.
     * @param {Number} lon - Longitude, in degrees.
     * @returns {Promise<Node>} Promise to the node that was navigated to.
     * @throws {Error} If no nodes exist close to provided latitude
     * longitude.
     * @throws {Error} Propagates any IO errors to the caller.
     */
    public moveCloseTo(lat: number, lon: number): when.Promise<Node> {
        return when.promise<Node>((resolve: any, reject: any): void => {
            this._navigator.moveCloseTo$(lat, lon).subscribe(
                (node: Node): void => {
                    resolve(node);
                },
                (error: Error): void => {
                    reject(error);
                });
        });
    }

    /**
     * Navigate in a given direction.
     *
     * @description This method has to be called through EdgeDirection enumeration as in the example.
     *
     * @param {EdgeDirection} dir - Direction in which which to move.
     * @returns {Promise<Node>} Promise to the node that was navigated to.
     * @throws {Error} If the current node does not have the edge direction
     * or the edges has not yet been cached.
     * @throws {Error} Propagates any IO errors to the caller.
     *
     * @example `viewer.moveDir(Mapillary.EdgeDirection.Next);`
     */
    public moveDir(dir: EdgeDirection): when.Promise<Node> {
        return when.promise<Node>((resolve: any, reject: any): void => {
            this._navigator.moveDir$(dir).subscribe(
                (node: Node): void => {
                    resolve(node);
                },
                (error: Error): void => {
                    reject(error);
                });
        });
    }

    /**
     * Navigate to a given photo key.
     *
     * @param {string} key - A valid Mapillary photo key.
     * @returns {Promise<Node>} Promise to the node that was navigated to.
     * @throws {Error} Propagates any IO errors to the caller.
     */
    public moveToKey(key: string): when.Promise<Node> {
        return when.promise<Node>((resolve: any, reject: any): void => {
            this._navigator.moveToKey$(key).subscribe(
                (node: Node): void => {
                    resolve(node);
                },
                (error: Error): void => {
                    reject(error);
                });
        });
    }

    /**
     * Detect the viewer's new width and height and resize it.
     *
     * @description The components will also detect the viewer's
     * new size and resize their rendered elements if needed.
     */
    public resize(): void {
        this._container.renderService.resize$.next(null);
        this._componentController.resize();
    }

    /**
     * Set a bearer token for authenticated API requests of
     * protected resources.
     *
     * @description When the supplied token is null or undefined,
     * any previously set bearer token will be cleared and the
     * viewer will make unauthenticated requests.
     *
     * Calling setAuthToken aborts all outstanding move requests.
     * The promises of those move requests will be rejected and
     * the rejections need to be caught.
     *
     * @param {string} [token] token - Bearer token.
     * @returns {Promise<void>} Promise that resolves after token
     * is set.
     */
    public setAuthToken(token?: string): when.Promise<void> {
        return when.promise<void>(
            (resolve: any, reject: any): void => {
                this._navigator.setToken$(token)
                    .subscribe(
                        (): void => {
                            resolve(undefined);
                        },
                        (error: Error): void => {
                            reject(error);
                        });
            });
    }

    /**
     * Set the basic coordinates of the current photo to be in the
     * center of the viewport.
     *
     * @description Basic coordinates are 2D coordinates on the [0, 1] interval
     * and has the origin point, (0, 0), at the top left corner and the
     * maximum value, (1, 1), at the bottom right corner of the original
     * photo.
     *
     * @param {number[]} The basic coordinates of the current
     * photo to be at the center for the viewport.
     */
    public setCenter(center: number[]): void {
        this._navigator.stateService.setCenter(center);
    }

    /**
     * Set the filter selecting nodes to use when calculating
     * the spatial edges.
     *
     * @description The following filter types are supported:
     *
     * Comparison
     *
     * `["==", key, value]` equality: `node[key] = value`
     *
     * `["!=", key, value]` inequality: `node[key] ≠ value`
     *
     * `["<", key, value]` less than: `node[key] < value`
     *
     * `["<=", key, value]` less than or equal: `node[key] ≤ value`
     *
     * `[">", key, value]` greater than: `node[key] > value`
     *
     * `[">=", key, value]` greater than or equal: `node[key] ≥ value`
     *
     * Set membership
     *
     * `["in", key, v0, ..., vn]` set inclusion: `node[key] ∈ {v0, ..., vn}`
     *
     * `["!in", key, v0, ..., vn]` set exclusion: `node[key] ∉ {v0, ..., vn}`
     *
     * Combining
     *
     * `["all", f0, ..., fn]` logical `AND`: `f0 ∧ ... ∧ fn`
     *
     * A key must be a string that identifies a node property name. A value must be
     * a string, number, or boolean. Strictly-typed comparisons are used. The values
     * `f0, ..., fn` of the combining filter must be filter expressions.
     *
     * Clear the filter by setting it to null or empty array.
     *
     * @param {FilterExpression} filter - The filter expression.
     * @returns {Promise<void>} Promise that resolves after filter is applied.
     *
     * @example `viewer.setFilter(["==", "sequenceKey", "<my sequence key>"]);`
     */
    public setFilter(filter: FilterExpression): when.Promise<void> {
        return when.promise<void>(
            (resolve: any, reject: any): void => {
                this._navigator.setFilter$(filter)
                    .subscribe(
                        (): void => {
                            resolve(undefined);
                        },
                        (error: Error): void => {
                            reject(error);
                        });
            });
    }

    /**
     * Set the viewer's render mode.
     *
     * @param {RenderMode} renderMode - Render mode.
     *
     * @example `viewer.setRenderMode(Mapillary.RenderMode.Letterbox);`
     */
    public setRenderMode(renderMode: RenderMode): void {
        this._container.renderService.renderMode$.next(renderMode);
    }

    /**
     * Set the photo's current zoom level.
     *
     * @description Possible zoom level values are on the [0, 3] interval.
     * Zero means zooming out to fit the photo to the view whereas three
     * shows the highest level of detail.
     *
     * @param {number} The photo's current zoom level.
     */
    public setZoom(zoom: number): void {
        this._navigator.stateService.setZoom(zoom);
    }
}
