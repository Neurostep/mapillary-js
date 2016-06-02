/// <reference path="../../../typings/browser.d.ts" />

import * as vd from "virtual-dom";

import {
    ISequenceConfiguration,
    SequenceComponent,
    SequenceDOMInteraction,
} from "../../Component";
import {EdgeDirection} from "../../Edge";
import {Node} from "../../Graph";
import {Navigator} from "../../Viewer";

export class SequenceDOMRenderer {
    public render(
        node: Node,
        configuration: ISequenceConfiguration,
        component: SequenceComponent,
        interaction: SequenceDOMInteraction,
        navigator: Navigator): vd.VNode {

        if (configuration.visible === false) {
            return vd.h("div.SequenceContainer", {}, []);
        }

        let nextKey: string = null;
        let prevKey: string = null;

        for (let edge of node.edges) {
            if (edge.data.direction === EdgeDirection.Next) {
                nextKey = edge.to;
            }

            if (edge.data.direction === EdgeDirection.Prev) {
                prevKey = edge.to;
            }
        }

        let playingButton: vd.VNode = this._createPlayingButton(nextKey, prevKey, configuration, component);
        let arrows: vd.VNode[] = this._createSequenceArrows(nextKey, prevKey, node, configuration, interaction, navigator);

        let containerProperties: vd.createProperties = {
            style: { height: "30px", width: "117px" },
        };

        return vd.h("div.SequenceContainer", containerProperties, arrows.concat([playingButton]));
    }

    private _createPlayingButton(
        nextKey: string,
        prevKey: string,
        configuration: ISequenceConfiguration,
        component: SequenceComponent): vd.VNode {

        let canPlay: boolean = configuration.direction === EdgeDirection.Next && nextKey != null ||
            configuration.direction === EdgeDirection.Prev && prevKey != null;

        let onclick: (e: Event) => void = configuration.playing ?
            (e: Event): void => { component.stop(); } :
            canPlay ? (e: Event): void => { component.play(); } : null;

        let buttonProperties: vd.createProperties = {
            onclick: onclick,
            style: {

            },
        };

        let buttonClass: string = canPlay ? "SequencePlay" : "SequencePlayDisabled";

        let icon: vd.VNode = vd.h("span", { textContent: configuration.playing ? "s" : "p" }, []);

        return vd.h("div." + buttonClass, buttonProperties, [icon]);
    }

    private _createSequenceArrows(
        nextKey: string,
        prevKey: string,
        node: Node,
        configuration: ISequenceConfiguration,
        interaction: SequenceDOMInteraction,
        navigator: Navigator): vd.VNode[] {

        let nextProperties: vd.createProperties = {
            onclick: nextKey != null ?
                (e: Event): void => { navigator.moveDir(EdgeDirection.Next).subscribe(); } :
                null,
            onmouseenter: (e: MouseEvent): void => { interaction.mouseEnterDirection$.onNext(EdgeDirection.Next); },
            onmouseleave: (e: MouseEvent): void => { interaction.mouseLeaveDirection$.onNext(EdgeDirection.Next); },
            style: {

            },
        };

        let prevProperties: vd.createProperties = {
            onclick: prevKey != null ?
                (e: Event): void => { navigator.moveDir(EdgeDirection.Prev).subscribe(); } :
                null,
            onmouseenter: (e: MouseEvent): void => { interaction.mouseEnterDirection$.onNext(EdgeDirection.Prev); },
            onmouseleave: (e: MouseEvent): void => { interaction.mouseLeaveDirection$.onNext(EdgeDirection.Prev); },
            style: {

            },
        };

        let nextClass: string = this._getStepClassName(EdgeDirection.Next, nextKey, configuration.highlightKey);
        let prevClass: string = this._getStepClassName(EdgeDirection.Prev, prevKey, configuration.highlightKey);

        let nextIcon: vd.VNode = vd.h("span", { textContent: "n" }, []);
        let prevIcon: vd.VNode = vd.h("span", { textContent: "p" }, []);

        return [
            vd.h("div." + nextClass, nextProperties, [nextIcon]),
            vd.h("div." + prevClass, prevProperties, [prevIcon]),
        ];
    }

    private _getStepClassName(direction: EdgeDirection, key: string, highlightKey: string): string {
        let className: string = direction === EdgeDirection.Next ?
            "SequenceStepNext" :
            "SequenceStepPrev";

        if (key == null) {
            return className + "Disabled";
        }

        if (highlightKey != null && highlightKey === key) {
            return className + "Highlight";
        }

        return className;
    }
}

export default SequenceDOMRenderer;