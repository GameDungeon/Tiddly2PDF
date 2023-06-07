import { IParseTreeNode, IWidgetInitialiseOptions, Tiddler } from 'tiddlywiki';
import { widget as Widget } from '$:/core/modules/widgets/widget.js';
import { compressSync, strFromU8, strToU8 } from "fflate";

async function toBase64(file:File):Promise<string> {
    return new Promise<string> ((resolve,reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => resolve(reader.result?.toString().split(',')[1] || '');
        reader.onerror = error => reject(error);
    })
}

class FontUploader extends Widget {
    tiddler: string | undefined;
    field: string | undefined;

    constructor(parseTreeNode: IParseTreeNode, options: IWidgetInitialiseOptions) {
        super(parseTreeNode, options);

        this.initialise(parseTreeNode,options);

        this.tiddler = undefined;
        this.field = undefined;
    }

    // @ts-ignore
    render(parent: Node, nextSibling: Node) {
        this.computeAttributes();
        this.execute();

        let input = document.createElement('input');
        input.type = "file";
        input.accept = ".ttf";
        input.style.cssText = "color:transparent;";
        input.addEventListener("change", async () => {
            if(input.files === null)
                return;

            const file = input.files[0];

            const b64 = strFromU8(compressSync(strToU8(await toBase64(file), true), {level: 6, mem: 4}), true);

            let path = `$:/fonts/${file.name}`;

            $tw.wiki.addTiddler(new $tw.Tiddler({title: path, text:b64, body:"hide"}))

            $tw.wiki.setText(this.tiddler!, this.field, undefined, path);
        }, false)

        parent.insertBefore(input, nextSibling);
    }

    execute(): void {
        this.field = this.getAttribute("field");
        this.tiddler = this.getVariable("currentTiddler");
    }
}

exports.fontUploader = FontUploader;
