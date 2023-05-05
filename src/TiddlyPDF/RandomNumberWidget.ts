import { IChangedTiddlers, IParseTreeNode, IWidgetInitialiseOptions } from 'tiddlywiki';
import { widget } from '$:/core/modules/widgets/widget.js';

class MyWidget extends widget {
  private title?: string;


  /** It will only be called automatically when rendering for the first time, when re-rendering after destruction, or actively through methods such as this.refreshSelf */
  render(parent: Node, nextSibling: Node) {
	  this.parentDomNode = parent;
    this.computeAttributes();

    this.title = this.getAttribute('title', undefined);

    var textNode = this.document.createTextNode(this.title);
    parent.insertBefore(textNode,nextSibling);
    this.domNodes.push(textNode);
  }

  /**
   * Optional, refresh is performed, if not defined, no refresh is done, but an attempt is made to refresh the children widgets
   * The returned value represents whether or not it is refreshed, and is used as a reference for the upper-level widget
   */
  refresh(changedTiddlers: IChangedTiddlers): boolean {
    // Update the parameters and find out which ones have changed
    const changedAttributes = this.computeAttributes();
    // Determine whether to perform a refresh or not, the determination here is just an example
    if (changedAttributes.title) {/// || changedTiddlers.includes(changedAttributes.title)) {
      // The refreshSelf of the base class function is simply a brutal removal of dom&chidren + re-rendering
      // For fine-grained refreshing, please implement your own
      this.refreshSelf();
      return true;
    }
    return false
  }
}

exports['my-widget'] = MyWidget;