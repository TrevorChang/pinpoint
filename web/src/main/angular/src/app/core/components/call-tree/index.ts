
import { NgModule } from '@angular/core';
import { AgGridModule } from 'ag-grid-angular';

import { SharedModule } from 'app/shared';
import { CallTreeComponent, DiffTreeComponent } from './call-tree.component';
import { CallTreeContainerComponent } from './call-tree-container.component';
import { DiffTreeContainerComponent } from './diff-tree-container.component';
import { MessagePopupModule } from 'app/core/components/message-popup';
import { SyntaxHighlightPopupModule } from 'app/core/components/syntax-highlight-popup';

@NgModule({
    declarations: [
        DiffTreeComponent,
        CallTreeComponent,
        CallTreeContainerComponent,
        DiffTreeContainerComponent
    ],
    imports: [
        SharedModule,
        AgGridModule.withComponents([]),
        MessagePopupModule,
        SyntaxHighlightPopupModule
    ],
    exports: [
        CallTreeContainerComponent,
        DiffTreeContainerComponent
    ],
    providers: []
})
export class CallTreeModule { }
