import { IWidgetEvent } from 'tiddlywiki';
import { widget as Widget } from '$:/core/modules/widgets/widget.js';

import pdfMake from "pdfmake/build/pdfmake";
import pdfFonts from 'pdfmake/build/vfs_fonts';

(pdfMake as any).vfs = pdfFonts.pdfMake.vfs;

import htmlToPdfmake from 'html-to-pdfmake';

const STYLEFILTER = "$:/config/Tiddly2PDF/styleFilter";
const PAGEFILTER = "$:/config/Tiddly2PDF/pageFilter";
const PAGEBREAK = "$:/config/Tiddly2PDF/pageBreakAfterTiddler";

interface docDefinition {
    content: any[],
    images: any,
    styles: any
}

const emptyDefaultStyle: any = {
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
    render(parent: Node, _nextSibling: Node) {
        this.computeAttributes();
        this.execute();
    }

    getTiddlerContent(path: string): string {
        return ($tw.wiki.getTiddler(path) as any).fields.text.trim()
    }

    getTidsFromFilterTid(path: string): string[] {
        return $tw.wiki.filterTiddlers(this.getTiddlerContent(path));
    }

    getPDFStyles() {
        let styleTiddlers = this.getTidsFromFilterTid(STYLEFILTER);

        let styleJSONS: any[] = [];
        styleTiddlers.forEach(tiddler => {
            styleJSONS.push(JSON.parse(this.getTiddlerContent(tiddler)))
        });

        // @ts-ignore
        return Object.assign(...styleJSONS);
    }

    invokeAction(triggeringWidget: Widget, event: IWidgetEvent) {

        let tiddlers = this.getTidsFromFilterTid(PAGEFILTER);

        let breakPages = (this.getTiddlerContent(PAGEBREAK) === "true") ? true : false;

        let dd: docDefinition = {
            content: [],
            images: {},
            styles: this.getPDFStyles()
        };

        tiddlers.forEach((tiddler, i) => {
            let options = {};

            let parser = $tw.wiki.parseTiddler(tiddler, options)
            let widgetNode = $tw.wiki.makeWidget(parser, options);

            let container = $tw.fakeDocument.createElement("div");

            widgetNode.render(container, null);

            let html: { content: any[], images: string[] } = (htmlToPdfmake(container.innerHTML, {
                imagesByReference: true,
                defaultStyles: emptyDefaultStyle,
            }) as any)

            if (breakPages && i < tiddlers.length - 1) {
                html.content[html.content.length - 1].pageBreak = 'after';
            }

            dd.content.push(...html.content);
            if (Object.keys(html.images).length !== 0) {
                Object.assign(dd.images, html.images);
            }
        })

        //console.log(docDefinition)

        pdfMake.createPdf(dd).download();

        return true; // Action was invoked
    };
}

exports.exportAsPDF = ExportAsPDF;
