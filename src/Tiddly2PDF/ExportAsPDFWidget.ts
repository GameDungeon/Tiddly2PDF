import { IWidgetEvent } from 'tiddlywiki';
import { widget as Widget } from '$:/core/modules/widgets/widget.js';

import pdfMake from "pdfmake/build/pdfmake";
import pdfFonts from 'pdfmake/build/vfs_fonts';

(pdfMake as any).vfs = pdfFonts.pdfMake.vfs;

import htmlToPdfmake from 'html-to-pdfmake';

const STYLEFILTER = "$:/config/Tiddly2PDF/styleFilter";
const PAGEFILTER = "$:/config/Tiddly2PDF/pageFilter";

const emptyDefaultStyle = {
    b: '',
    strong: '',
    u: '',
    s: '',
    em: '',
    i: '',
    h1: '',
    h2: '',
    h3: '',
    h4: '',
    h5: '',
    h6: '',
    a: '',
    strike: '',
    p: '',
    ul: '',
    li: '',
    table: '',
    th: ''
}

class ExportAsPDF extends Widget {
    // @ts-ignore
    render(parent: Node, _nextSibling: Node): void {
        this.computeAttributes();
        this.execute();
    }

    invokeAction(triggeringWidget: Widget, event: IWidgetEvent) {

        var tiddlers = $tw.wiki.filterTiddlers($tw.wiki.getTiddler(PAGEFILTER).fields.text.trim());

        var styleTiddlers = $tw.wiki.filterTiddlers($tw.wiki.getTiddler(STYLEFILTER).fields.text.trim());

        var styleJSONS = [];
        styleTiddlers.forEach(tiddler => {
            styleJSONS.push(JSON.parse($tw.wiki.getTiddler(tiddler).fields.text.trim()))
        });

        var styles = Object.assign(...styleJSONS);

        var docDefinition = {
            content: [],
            images: {},
            styles: styles
        };

        let breakEvery = true;

        tiddlers.forEach((tiddler, i) => {
            var options = {};

            var parser = $tw.wiki.parseTiddler(tiddler, options)
            var widgetNode = $tw.wiki.makeWidget(parser, options);

            var container = $tw.fakeDocument.createElement("div");

            widgetNode.render(container, null);

            // @ts-ignore
            var html: { content: any[], images: string[] } = htmlToPdfmake(container.innerHTML, {
                imagesByReference: true,
                // @ts-ignore
                defaultStyles: emptyDefaultStyle,
            })

            if (breakEvery && i < tiddlers.length - 1) {
                html.content[html.content.length - 1].pageBreak = 'after';
            }

            // @ts-ignore
            docDefinition.content.push(...html.content);
            if (Object.keys(html.images).length !== 0) {
                // @ts-ignore
                Object.assign(docDefinition.images, html.images);
            }
        })

        //console.log(docDefinition)

        pdfMake.createPdf(<any>docDefinition).download();

        return true; // Action was invoked
    };
}

exports.exportAsPDF = ExportAsPDF;
