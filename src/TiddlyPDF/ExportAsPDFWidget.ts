import { IWidgetEvent } from 'tiddlywiki';
import { widget as Widget } from '$:/core/modules/widgets/widget.js';

import pdfMake from "pdfmake/build/pdfmake";
import pdfFonts from 'pdfmake/build/vfs_fonts';

(pdfMake as any).vfs = pdfFonts.pdfMake.vfs;

import htmlToPdfmake from 'html-to-pdfmake';
import { Content } from 'pdfmake/interfaces';

class ExportAsPDF extends Widget {
    render(parent: Node, _nextSibling: Node): void {
        this.computeAttributes();
        this.execute();
    }

    invokeAction(triggeringWidget: Widget, event: IWidgetEvent) {

        var tiddlers:string[] = $tw.wiki.filterTiddlers("[tag[notebook]]");

        var docDefinition = {content:[],
                            images:[]};

        tiddlers.forEach(tiddler => {
            var options = {};

            var parser =  $tw.wiki.parseTiddler(tiddler,options)
            var widgetNode = $tw.wiki.makeWidget(parser,options);

            var container = $tw.fakeDocument.createElement("div");
    
            widgetNode.render(container,null);

            // @ts-ignore
            var html: {content: any[], images: string[]} = htmlToPdfmake(container.innerHTML, {imagesByReference:true})

            html.content[html.content.length - 1].pageBreak = 'after'; 

            docDefinition.content.push(...html.content);
            if(Object.keys(html.images).length !== 0) {
                docDefinition.images.push(...html.images);
            }
        })

        console.log(docDefinition)

        pdfMake.createPdf(<any>docDefinition).download();

        return true; // Action was invoked
    };
}

exports.exportAsPDF = ExportAsPDF;
