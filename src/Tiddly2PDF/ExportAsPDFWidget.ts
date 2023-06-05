import { IWidgetEvent } from 'tiddlywiki';
import { widget as Widget } from '$:/core/modules/widgets/widget.js';

import pdfMake from "pdfmake/build/pdfmake";
import pdfFonts from 'pdfmake/build/vfs_fonts';

(pdfMake as any).vfs = pdfFonts.pdfMake.vfs;

import htmlToPdfmake from 'html-to-pdfmake';

const STYLEFILTER = "$:/config/Tiddly2PDF/styleFilter";
const PAGEFILTER = "$:/config/Tiddly2PDF/pageFilter";
const PAGEBREAK = "$:/config/Tiddly2PDF/pageBreakAfterTiddler";
const HEADERTEMPLATEPATH = "$:/config/Tiddly2PDF/headerTemplate";
const FOOTERTEMPLATEPATH = "$:/config/Tiddly2PDF/footerTemplate";
const PAGETEMPLATEPATH = "$:/config/Tiddly2PDF/pageTemplate";
const BACKGROUNDTEMPLATEPATH = "$:/config/Tiddly2PDF/backgroundTemplate";

interface docDefinition {
    header: CallableFunction,
    footer: CallableFunction,
    background: CallableFunction,
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

        let headerHTML = this.getTiddlerContent(this.getTiddlerContent(HEADERTEMPLATEPATH));
        let footerHTML = this.getTiddlerContent(this.getTiddlerContent(FOOTERTEMPLATEPATH));
        let pageHTML   = this.getTiddlerContent(this.getTiddlerContent(PAGETEMPLATEPATH));
        let backgroundHTML = this.getTiddlerContent(this.getTiddlerContent(BACKGROUNDTEMPLATEPATH));

        let headerFunction = function(currentPage: number, pageCount: number, pageSize: any): any {
            let currentHeaderHTML = headerHTML
                .replaceAll("$currentPage", currentPage.toString())
                .replaceAll("$pageCount",   pageCount.toString());
     
            return htmlToPdfmake(currentHeaderHTML, {
                defaultStyles: emptyDefaultStyle,
            })
        }

        let footerFunction = function(currentPage: number, pageCount: number, pageSize: any): any {
            let currentFooterHTML = footerHTML
                .replaceAll("$currentPage", currentPage.toString())
                .replaceAll("$pageCount",   pageCount.toString());

            return htmlToPdfmake(currentFooterHTML, {
                defaultStyles: emptyDefaultStyle,
            })
        }

        let backgroundFunction = function(currentPage: number, pageSize: any): any {
            let currentBackgroundHTML = backgroundHTML
                .replaceAll("$currentPage", currentPage.toString());

            return htmlToPdfmake(currentBackgroundHTML, {
                defaultStyles: emptyDefaultStyle,
            })
        }

        let dd: docDefinition = {
            header: headerFunction,
            footer: footerFunction,
            background: backgroundFunction,
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

            let bodyHtml = container.innerHTML;

            let currentPageHTML = pageHTML
                .replaceAll("$title", tiddler)
                .replaceAll("$body", bodyHtml)

            let html: { content: any[], images: string[] } = <any>htmlToPdfmake(currentPageHTML, {
                imagesByReference: true,
                defaultStyles: emptyDefaultStyle,
            })

            if (breakPages && i < tiddlers.length - 1) {
                html.content[html.content.length - 1].pageBreak = 'after';
            }

            dd.content.push(...html.content);
            if (Object.keys(html.images).length !== 0) {
                Object.assign(dd.images, html.images);
            }
        })

        //console.log(dd)

        pdfMake.createPdf(<any>dd).download();

        return true; // Action was invoked
    };
}

exports.exportAsPDF = ExportAsPDF;
