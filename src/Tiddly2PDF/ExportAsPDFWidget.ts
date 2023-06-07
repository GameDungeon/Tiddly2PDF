import { IWidgetEvent } from 'tiddlywiki';
import { widget as Widget } from '$:/core/modules/widgets/widget.js';
import { decompressSync, strFromU8, strToU8 } from 'fflate';

import pdfMake from "pdfmake/build/pdfmake";
import htmlToPdfmake from 'html-to-pdfmake';

const STYLEFILTER = "$:/config/Tiddly2PDF/styleFilter";
const PAGEFILTER = "$:/config/Tiddly2PDF/pageFilter";
const PAGEBREAK = "$:/config/Tiddly2PDF/pageBreakAfterTiddler";
const HEADERTEMPLATEPATH = "$:/config/Tiddly2PDF/headerTemplate";
const FOOTERTEMPLATEPATH = "$:/config/Tiddly2PDF/footerTemplate";
const PAGETEMPLATEPATH = "$:/config/Tiddly2PDF/pageTemplate";
const BACKGROUNDTEMPLATEPATH = "$:/config/Tiddly2PDF/backgroundTemplate";
const DEFAULTFONT = "$:/config/Tiddly2PDF/defaultFont";
const FILENAME = "$:/config/Tiddly2PDF/fileName";

const FONTFILTER = "[all[shadows+tiddlers]tag[$:/tags/Tiddly2PDF/PDFFont]!is[draft]]"

interface docDefinition {
    header: CallableFunction,
    footer: CallableFunction,
    background: CallableFunction,
    content: any[],
    images: any,
    styles: any,
    defaultStyle: any
}

interface fontFamily {
    normal: string,
    bold: string,
    italics: string,
    bolditalics: string
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

        const tiddlers = this.getTidsFromFilterTid(PAGEFILTER);

        const fonts = $tw.wiki.filterTiddlers(FONTFILTER);
        const defFont = this.getTiddlerContent(DEFAULTFONT);

        const breakPages = (this.getTiddlerContent(PAGEBREAK) === "true") ? true : false;

        const headerHTML = this.getTiddlerContent(this.getTiddlerContent(HEADERTEMPLATEPATH));
        const footerHTML = this.getTiddlerContent(this.getTiddlerContent(FOOTERTEMPLATEPATH));
        const pageHTML   = this.getTiddlerContent(this.getTiddlerContent(PAGETEMPLATEPATH));
        const backgroundHTML = this.getTiddlerContent(this.getTiddlerContent(BACKGROUNDTEMPLATEPATH));

        const fileName = this.getTiddlerContent(FILENAME);

        pdfMake.vfs = {};

        let fontData: any = {} 
        fonts.forEach((font) => {
            let fontTid = $tw.wiki.getTiddler(font);

            let normal = strFromU8(decompressSync(strToU8(
                this.getTiddlerContent((fontTid as any).fields.normal), true
            )), true);

            let bold = strFromU8(decompressSync(strToU8(
                this.getTiddlerContent((fontTid as any).fields.bold), true
            )), true);

            let italic = strFromU8(decompressSync(strToU8(
                this.getTiddlerContent((fontTid as any).fields.italic), true
            )), true);

            let italicbold = strFromU8(decompressSync(strToU8(
                this.getTiddlerContent((fontTid as any).fields.italicbold), true
            )), true);

            pdfMake.vfs[`${font}-normal`] = normal;
            pdfMake.vfs[`${font}-bold`] = bold;
            pdfMake.vfs[`${font}-italic`] = italic;
            pdfMake.vfs[`${font}-italicbold`] = italicbold;

            let fontFam: fontFamily = {
                normal: `${font}-normal`,
                bold: `${font}-bold`,
                italics: `${font}-italic`,
                bolditalics: `${font}-italicbold`
            }

            fontData[(fontTid as any).fields.caption] = fontFam;
        })

        pdfMake.fonts = fontData;

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
            styles: this.getPDFStyles(),
            defaultStyle: {
                font: defFont
            }
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

        pdfMake.createPdf(<any>dd).download(fileName);

        return true;
    };
}

exports.exportAsPDF = ExportAsPDF;