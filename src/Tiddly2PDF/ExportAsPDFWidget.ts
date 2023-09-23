import { IWidgetEvent, Tiddler } from 'tiddlywiki';
import { widget as Widget } from '$:/core/modules/widgets/widget.js';
import { decompressSync, strFromU8, strToU8 } from 'fflate';

import css from "css";

// @ts-ignore
import pdfMake from "pdfmake/build/pdfmake";

// @ts-ignore
import htmlToPdfmake from 'html-to-pdfmake';
import { AnyCnameRecord } from 'dns';

const STYLEFILTER = "$:/config/Tiddly2PDF/styleFilter";
const PAGEFILTER = "$:/config/Tiddly2PDF/pageFilter";
const PAGEBREAK = "$:/config/Tiddly2PDF/pageBreakAfterTiddler";
const TOC = "$:/config/Tiddly2PDF/tableOfContents";
const HEADERTEMPLATEPATH = "$:/config/Tiddly2PDF/headerTemplate";
const FOOTERTEMPLATEPATH = "$:/config/Tiddly2PDF/footerTemplate";
const PAGETEMPLATEPATH = "$:/config/Tiddly2PDF/pageTemplate";
const BACKGROUNDTEMPLATEPATH = "$:/config/Tiddly2PDF/backgroundTemplate";
const TOCTEMPLATEPATH = "$:/config/Tiddly2PDF/tableOfContentsTemplate";
const TOCLINETEMPLATEPATH = "$:/config/Tiddly2PDF/tableOfContentsLineTemplate";
const DEFAULTFONT = "$:/config/Tiddly2PDF/defaultFont";
const FILENAME = "$:/config/Tiddly2PDF/fileName";

const FONTFILTER = "[all[shadows+tiddlers]tag[$:/tags/Tiddly2PDF/PDFFont]!is[draft]]"

interface docDefinition {
    header: CallableFunction,
    footer: CallableFunction,
    background?: CallableFunction,
    info?: any,
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

interface pageGroup {
    GroupName: string,     
    GroupPageStart: number,
    GroupPageEnd: number
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
    singleTiddler: string | undefined;

    // @ts-ignore
    render(parent: Node, _nextSibling: Node) {
        this.computeAttributes();
        this.execute();
    }

    execute() {
        this.singleTiddler = this.getAttribute("$tiddler");
    }

    refresh(changedTiddlers: any) { 
        var changedAttributes = this.computeAttributes();
        if($tw.utils.count(changedAttributes) > 0) {
            this.refreshSelf();
            return true;
        }
        return this.refreshChildren(changedTiddlers);
    };

    getTiddlerContent(path: string): string {
        return ($tw.wiki.getTiddler(path) as any).fields.text.trim()
    }

    getTidsFromFilterTid(path: string): string[] {
        return $tw.wiki.filterTiddlers(this.getTiddlerContent(path));
    }

    getGroupFromPage(groups: pageGroup[], i: number): pageGroup {

        if(i < 1)
            return groups[0];
        
        for (const group of groups) {
            if (i >= group.GroupPageStart && group.GroupPageEnd >= i) {
              return group;
            }
        }

        return groups[groups.length - 1];
    }

    getPDFStyles() {
        let styleTiddlers = this.getTidsFromFilterTid(STYLEFILTER);

        let cssString: string = "";
        styleTiddlers.forEach(tiddler => {
            cssString += "\n" + this.getTiddlerContent(tiddler)
        });

        let styles: css.Stylesheet = css.parse(cssString);

        var parsedStyles: any = {};

        styles.stylesheet!.rules.forEach((rule: css.Rule) => {
            if(rule['type'] !== 'rule')
                return;

            rule.selectors!.forEach(selectorOrg => {
                let selector = selectorOrg.charAt(0) == '.' ? selectorOrg.substring(1) : selectorOrg;
                selector = selector.charAt(selector.length-1) == ':' ? selector.substring(0, selector.length-1) : selector;
                rule.declarations!.forEach((declaration: css.Declaration) => {
                    if(parsedStyles[selector] === undefined)
                        parsedStyles[selector] = {}

                    let val = declaration.value;
                    try {
                        val = JSON.parse(declaration.value!);
                    } catch {}

                    parsedStyles[selector][declaration.property!] = val;
                });
            });
        });

        return parsedStyles;
    }

    loadFonts() {
        const fonts = $tw.wiki.filterTiddlers(FONTFILTER);

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
    }

    generateTOC(tiddlers: any[], groups: pageGroup[]): any {
        const tocHTML = this.getTiddlerContent(this.getTiddlerContent(TOCTEMPLATEPATH));
        const tocLineHTML = this.getTiddlerContent(this.getTiddlerContent(TOCLINETEMPLATEPATH));

        let offset = 0;
        if(groups.length > 0) {
            offset = groups[0].GroupPageEnd;
        }

        let tocAddedHTML = "";
        tiddlers.forEach((tiddlerTitle, i) => {
            let tiddler = $tw.wiki.getTiddler(tiddlerTitle);
            let fields = (tiddler as any).getFieldStrings();

            let currentLineHTML = tocLineHTML;
            for (let key in fields) {
                currentLineHTML = currentLineHTML.replaceAll("$" + key, fields[key]);
            }
            
            if(groups.length > 0) {
                currentLineHTML = currentLineHTML.replaceAll("$page", (groups[i + 1].GroupPageStart - offset).toString());
                currentLineHTML = currentLineHTML.replaceAll("$end", (groups[i + 1].GroupPageEnd - offset).toString());
            }

            tocAddedHTML += currentLineHTML;
        })

        tocAddedHTML = tocHTML.replaceAll("$toc-lines", tocAddedHTML);

        let html: { content: any[], images: string[] } = <any>htmlToPdfmake(tocAddedHTML, {
            imagesByReference: true,
            defaultStyles: emptyDefaultStyle,
        })
        
        html.content[0].GroupStart = true;
        html.content[0].GroupName = "index";
        html.content[html.content.length - 1].pageBreak = 'after';

        return html;
    }

    async createPDF() {

        let tiddlers;

        if(this.singleTiddler === undefined) {
            tiddlers = this.getTidsFromFilterTid(PAGEFILTER);
        } else {
            tiddlers = [this.singleTiddler];
        }

        const defFont = this.getTiddlerContent(DEFAULTFONT);

        const breakPages = (this.getTiddlerContent(PAGEBREAK) === "true") ? true : false;
        const addToc = (this.getTiddlerContent(TOC) === "true") ? true : false;

        const headerHTML = this.getTiddlerContent(this.getTiddlerContent(HEADERTEMPLATEPATH));
        const footerHTML = this.getTiddlerContent(this.getTiddlerContent(FOOTERTEMPLATEPATH));
        const pageHTML   = this.getTiddlerContent(this.getTiddlerContent(PAGETEMPLATEPATH));
        const backgroundHTML = this.getTiddlerContent(this.getTiddlerContent(BACKGROUNDTEMPLATEPATH));

        const fileName = this.getTiddlerContent(FILENAME);

        console.log(tiddlers);

        this.loadFonts();

        let dd: docDefinition = {
            header: () => {
                return htmlToPdfmake(headerHTML, {
                    defaultStyles: emptyDefaultStyle,
                })
            },
            footer: () => {
                return htmlToPdfmake(footerHTML, {
                    defaultStyles: emptyDefaultStyle,
                })
            },
            info: {
                title: fileName,
            },            
            content: [],
            images: {},
            styles: this.getPDFStyles(),
            defaultStyle: {
                font: defFont,
                fontSize: 14
            }
        };

        tiddlers.forEach((tiddlerTitle, i) => {
            let options = {};

            let tiddler = $tw.wiki.getTiddler(tiddlerTitle);
            let parser = $tw.wiki.parseTiddler(tiddlerTitle, options)
            let widgetNode = $tw.wiki.makeWidget(parser, options);
            let fields = (tiddler as any).getFieldStrings();

            let container = $tw.fakeDocument.createElement("div");

            widgetNode.render(container, null);

            let bodyHtml = container.innerHTML; 
            
            let title = tiddlerTitle;
            if((tiddler as any).getFieldString("pdf-title") == "hide") {
                title = "";
            }

            let currentPageHTML = pageHTML.replaceAll("$title", title);
            for (let key in fields) {
                currentPageHTML = currentPageHTML.replaceAll("$" + key, fields[key]);
            }
            currentPageHTML = currentPageHTML.replaceAll("$body", bodyHtml);

            let html: { content: any[], images: string[] } = <any>htmlToPdfmake(currentPageHTML, {
                imagesByReference: true,
                defaultStyles: emptyDefaultStyle
            })

            html.content[0].GroupStart = true;
            html.content[0].GroupName = tiddlerTitle;

            if (breakPages && i < tiddlers.length - 1) {
                html.content[html.content.length - 1].pageBreak = 'after';
            }

            dd.content.push(...html.content);
            if (Object.keys(html.images).length !== 0) {
                Object.assign(dd.images, html.images);
            }
        });

        for (const [key, value] of Object.entries(dd.images)) {
            let srcImg = new Image();
            srcImg.crossOrigin = "anonymous";
            srcImg.src = (value as string);

            await srcImg.decode();

            const canvas = document.createElement('canvas');
            canvas.width = srcImg.width;
            canvas.height = srcImg.height;

            canvas.getContext('2d')?.drawImage(srcImg, 0, 0);
            dd.images[key] = canvas.toDataURL("image/png", 0.7);
        }

        var pdfDocGenerator;

        let ddCopy: docDefinition = JSON.parse(JSON.stringify(dd));

        if(addToc) {
            let html = this.generateTOC(tiddlers, [])

            dd.content.unshift(...html.content)
            if (Object.keys(html.images).length !== 0) {
                Object.assign(dd.images, html.images);
            }
        };

        pdfDocGenerator = pdfMake.createPdf(<any>dd);

        // This modifies dd to add positions, the return value is never used.
        pdfDocGenerator.getStream();

        let pdf_groups: pageGroup[] = [];
        let grouping = 0;

        for (let x=0; x < dd.content.length; x++) {
            if (dd.content[x].GroupStart != undefined && dd.content[x].GroupStart == true) {

                if(pdf_groups.length != 0) {
                    pdf_groups[grouping].GroupPageEnd = dd.content[x].positions[0].pageNumber - 1;
                    grouping++;
                }

                pdf_groups.push({ 
                    GroupName: dd.content[x].GroupName, 
                    GroupPageStart: dd.content[x].positions[0].pageNumber, 
                    GroupPageEnd: dd.content[x].positions[0].pageNumber
                });
            }
        }

        let pageOffset = 0;
        if(addToc && !this.singleTiddler) {
            let html = this.generateTOC(tiddlers, pdf_groups)

            ddCopy.content.unshift(...html.content)
            if (Object.keys(html.images).length !== 0) {
                Object.assign(ddCopy.images, html.images);
            }

            pageOffset = pdf_groups[0].GroupPageEnd;
        };

        ddCopy.header = (currentPage: number, pageCount: number): any => {
            let group = this.getGroupFromPage(pdf_groups, currentPage);

            if(group!.GroupName == "index") {
                return;
            }

            let title = group?.GroupName;
            let tiddler = $tw.wiki.getTiddler(title!);
            let fields = (tiddler as any).getFieldStrings();

            let currentHTML = headerHTML;
            for (let key in fields) {
                currentHTML = currentHTML.replaceAll("$" + key, fields[key]);
            }

            currentHTML = currentHTML
                .replaceAll("$currentPage", (currentPage - pageOffset).toString())
                .replaceAll("$pageCount",   (pageCount - pageOffset).toString());
     
            return htmlToPdfmake(currentHTML, {
                defaultStyles: emptyDefaultStyle,
            })
        }

        ddCopy.footer = (currentPage: number, pageCount: number): any => {
            let group = this.getGroupFromPage(pdf_groups, currentPage);

            if(group!.GroupName == "index") {
                return;
            }

            let title = group?.GroupName;
            let tiddler = $tw.wiki.getTiddler(title!);
            let fields = (tiddler as any).getFieldStrings();

            let currentHTML = footerHTML;
            for (let key in fields) {
                currentHTML = currentHTML.replaceAll("$" + key, fields[key]);
            }

            currentHTML = currentHTML
                .replaceAll("$currentPage", (currentPage - pageOffset).toString())
                .replaceAll("$pageCount",   (pageCount - pageOffset).toString());
     
            return htmlToPdfmake(currentHTML, {
                defaultStyles: emptyDefaultStyle,
            })
        }

        ddCopy.background = (currentPage: number): any => {
            let group = this.getGroupFromPage(pdf_groups, currentPage);

            if(group!.GroupName == "index") {
                return;
            }

            let title = group?.GroupName;
            let tiddler = $tw.wiki.getTiddler(title!);
            let fields = (tiddler as any).getFieldStrings();

            let currentHTML = backgroundHTML;
            for (let key in fields) {
                currentHTML = currentHTML.replaceAll("$" + key, fields[key]);
            }

            currentHTML = currentHTML
                .replaceAll("$currentPage", (currentPage - pageOffset).toString());
     
            return htmlToPdfmake(currentHTML, {
                defaultStyles: emptyDefaultStyle,
            })
        }

        pdfDocGenerator = pdfMake.createPdf(<any>ddCopy);

        pdfDocGenerator.open({});
    }

    invokeAction(triggeringWidget: Widget, event: IWidgetEvent) {
        this.createPDF();

        return true;
    };
}

exports.exportAsPDF = ExportAsPDF;
