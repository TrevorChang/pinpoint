import { Component, OnInit, OnDestroy, ComponentFactoryResolver, Injector, ViewChild, Renderer2, ElementRef, ChangeDetectorRef } from '@angular/core';
import { Subject } from 'rxjs';
import { filter, tap, switchMap } from 'rxjs/operators';

import {
    StoreHelperService,
    UrlRouteManagerService,
    TransactionDetailDataService,
    AnalyticsService,
    TRACKED_EVENT_LIST,
    DynamicPopupService,
} from 'app/shared/services';
import { Actions } from 'app/shared/store';
import { UrlPath } from 'app/shared/models';
import { HELP_VIEWER_LIST, HelpViewerPopupContainerComponent } from 'app/core/components/help-viewer-popup/help-viewer-popup-container.component';
import { ServerErrorPopupContainerComponent } from 'app/core/components/server-error-popup/server-error-popup-container.component';
import { CallTreeContainerComponent } from 'app/core/components/call-tree/call-tree-container.component';

@Component({
    selector: 'pp-transaction-list-bottom-contents-container',
    templateUrl: './transaction-list-bottom-contents-container.component.html',
    styleUrls: ['./transaction-list-bottom-contents-container.component.css']
})
export class TransactionListBottomContentsContainerComponent implements OnInit, OnDestroy {
    @ViewChild(CallTreeContainerComponent, {read: ElementRef, static: true}) callTreeComponent: ElementRef;
    @ViewChild('uploadFileInput', {read: ElementRef, static: true}) uploadFileInput: ElementRef;
    private unsubscribe = new Subject<void>();

    activeView: string;
    transactionInfo: ITransactionMetaData;
    transactionDetail: ITransactionDetailData;
    useDisable = true;
    showLoading = true;
    removeCallTree = false;
    showSearch: boolean;

    showUpload = false;
    diffDetailInfo: any;

    diffRowName = "executionMilliseconds";
    diffRowData = [];

    constructor(
        private storeHelperService: StoreHelperService,
        private urlRouteManagerService: UrlRouteManagerService,
        private transactionDetailDataService: TransactionDetailDataService,
        private analyticsService: AnalyticsService,
        private dynamicPopupService: DynamicPopupService,
        private componentFactoryResolver: ComponentFactoryResolver,
        private injector: Injector,
        private renderer: Renderer2,
        private cd: ChangeDetectorRef
    ) {}

    ngOnInit() {
        this.connectStore();
    }

    ngOnDestroy() {
        this.unsubscribe.next();
        this.unsubscribe.complete();
    }

    private connectStore(): void {
        this.storeHelperService.getTransactionViewType(this.unsubscribe).pipe(
            tap((viewType: string) => {
                this.renderer.setStyle(this.callTreeComponent.nativeElement, 'display', viewType === 'callTree' ? 'block' : 'none');
            })
        ).subscribe((viewType: string) => {
            this.activeView = viewType;
            this.diffDetailInfo = null;
            this.uploadFileInput.nativeElement.value = '';
            this.showUpload = this.activeView === 'compare'
            this.showSearch = this.activeView === 'callTree' || this.activeView === 'timeline';
        });

        this.storeHelperService.getTransactionData(this.unsubscribe).pipe(
            filter((data: ITransactionMetaData) => !!data),
            filter(({agentId, spanId, traceId, collectorAcceptTime}: ITransactionMetaData) => !!agentId && !!spanId && !!traceId && !!collectorAcceptTime),
            tap(() => {
                this.setDisplayGuide(true);
                this.renderer.setStyle(this.callTreeComponent.nativeElement, 'display', 'none');
            }),
            tap((transactionInfo: ITransactionMetaData) => this.transactionInfo = transactionInfo),
            switchMap(({agentId, spanId, traceId, collectorAcceptTime}: ITransactionMetaData) => this.transactionDetailDataService.getData(agentId, spanId, traceId, collectorAcceptTime)),
        ).subscribe((transactionDetailInfo: ITransactionDetailData) => {
            this.transactionDetail = transactionDetailInfo;
            this.storeHelperService.dispatch(new Actions.UpdateTransactionDetailData(transactionDetailInfo));
            this.storeHelperService.dispatch(new Actions.ChangeTransactionViewType('callTree'));
            this.setDisplayGuide(false);
            this.renderer.setStyle(this.callTreeComponent.nativeElement, 'display', 'block');
        }, (error: IServerErrorFormat) => {
            this.dynamicPopupService.openPopup({
                data: {
                    title: 'Error',
                    contents: error
                },
                component: ServerErrorPopupContainerComponent
            }, {
                resolver: this.componentFactoryResolver,
                injector: this.injector
            });
            this.setDisplayGuide(false);
            this.cd.detectChanges();
        });
    }

    private setDisplayGuide(state: boolean): void {
        this.showLoading = state;
        this.useDisable = state;
    }

    onOpenTransactionDetailPage(): void {
        this.analyticsService.trackEvent(TRACKED_EVENT_LIST.OPEN_TRANSACTION_DETAIL);
        this.urlRouteManagerService.openPage({
            path: [
                UrlPath.TRANSACTION_DETAIL,
                this.transactionInfo.traceId,
                this.transactionInfo.collectorAcceptTime + '',
                this.transactionInfo.agentId,
                this.transactionInfo.spanId
            ]
        });
    }

    onClickExportBtn(): void {
        console.log(this.transactionDetail);
        const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(this.transactionDetail));
        let downloadAnchorNode = document.createElement('a');
        downloadAnchorNode.setAttribute("href", dataStr);
        downloadAnchorNode.setAttribute("download", this.transactionDetail.transactionId + ".json");
        document.body.appendChild(downloadAnchorNode); // required for firefox
        downloadAnchorNode.click();
        downloadAnchorNode.remove();
    }

    fileChangeListener($event : Event): void {
        const comparedFile = ($event.target as HTMLInputElement).files[0];

        const fileReader = new FileReader();
        fileReader.onload = (e) => {
            this.diffDetailInfo = JSON.parse(<string>fileReader.result);
            console.log(this.diffDetailInfo);
            this.storeHelperService.dispatch(new Actions.UpdateDiffDetailData(this.diffDetailInfo));

            // this.updateDiffData();
        }

        if (comparedFile instanceof ArrayBuffer) {
            // throw an error, 'cause you can't handle this
        } else {
            fileReader.readAsText(comparedFile);
        }
    }

    hasDiffData(): boolean {
        return !!this.diffDetailInfo;
    }

    private updateDiffData(): void {
        const colSourceIndex = this.transactionDetail.callStackIndex[this.diffRowName];
        const colTargetIndex = this.diffDetailInfo.callStackIndex[this.diffRowName];
        let sourceData = this.transactionDetail.callStack.map(item=>item[colSourceIndex]);
        let targetData = this.diffDetailInfo.callStack.map(item=>item[colTargetIndex]);

        this.diffRowData = sourceData.map((v, idx)=>({
            title : this.transactionDetail.callStack[idx][this.transactionDetail.callStackIndex['title']],
            source : sourceData[idx],
            target : targetData[idx],
            diff : !isNaN(sourceData[idx]) && !isNaN(targetData[idx]) ? sourceData[idx] - targetData[idx] : ''
        }));
    }

    onShowHelp($event: MouseEvent): void {
        this.analyticsService.trackEvent(TRACKED_EVENT_LIST.TOGGLE_HELP_VIEWER, HELP_VIEWER_LIST.CALL_TREE);
        const {left, top, width, height} = ($event.target as HTMLElement).getBoundingClientRect();

        this.dynamicPopupService.openPopup({
            data: HELP_VIEWER_LIST.CALL_TREE,
            coord: {
                coordX: left + width / 2,
                coordY: top + height / 2
            },
            component: HelpViewerPopupContainerComponent
        }, {
            resolver: this.componentFactoryResolver,
            injector: this.injector
        });
    }
}
