import { Component, OnInit, OnDestroy, ChangeDetectionStrategy, ChangeDetectorRef } from '@angular/core';
import { Subject, combineLatest } from 'rxjs';
import { takeUntil, map, take } from 'rxjs/operators';

import { Actions } from 'app/shared/store';
import { UrlPathId } from 'app/shared/models';
import { StoreHelperService, NewUrlStateNotificationService, UrlRouteManagerService, AnalyticsService, TRACKED_EVENT_LIST, MessageQueueService, MESSAGE_TO } from 'app/shared/services';
import { ServerMapData } from 'app/core/components/server-map/class/server-map-data.class';
// import { ScatterChartDataService } from 'app/core/components/scatter-chart/scatter-chart-data.service';

@Component({
    selector: 'pp-server-status-container',
    templateUrl: './server-status-container.component.html',
    styleUrls: ['./server-status-container.component.css'],
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class ServerStatusContainerComponent implements OnInit, OnDestroy {
    private unsubscribe = new Subject<void>();
    private _isInfoPerServerShow: boolean;

    enableRealTime: boolean;
    node: INodeInfo;
    isLoading = false;
    serverMapData: ServerMapData;
    selectedTarget: ISelectedTarget;
    hasServerList = false;
    isWAS: boolean;
    spreadAngleIndicator: string;
    filterKeyword = '';

    constructor(
        private storeHelperService: StoreHelperService,
        private newUrlStateNotificationService: NewUrlStateNotificationService,
        private urlRouteManagerService: UrlRouteManagerService,
        private analyticsService: AnalyticsService,
        private cd: ChangeDetectorRef,
        private messageQueueService: MessageQueueService,
    ) {}

    ngOnInit() {
        this.newUrlStateNotificationService.onUrlStateChange$.pipe(
            takeUntil(this.unsubscribe)
        ).subscribe((urlService: NewUrlStateNotificationService) => {
            this.enableRealTime = urlService.isRealTimeMode();
            this.isInfoPerServerShow = false;
            this.storeHelperService.dispatch(new Actions.ChangeInfoPerServerVisibleState(false));
            this.cd.detectChanges();
        });
        this.listenToEmitter();
        this.initKeyword();
    }

    ngOnDestroy() {
        this.unsubscribe.next();
        this.unsubscribe.complete();
    }

    private listenToEmitter(): void {
        this.messageQueueService.receiveMessage(this.unsubscribe, MESSAGE_TO.SERVER_MAP_DATA_UPDATE).subscribe((data: ServerMapData) => {
            this.serverMapData = data;
        });

        this.messageQueueService.receiveMessage(this.unsubscribe, MESSAGE_TO.SERVER_MAP_TARGET_SELECT).subscribe((target: ISelectedTarget) => {
            this.selectedTarget = target;
            this.hasServerList = this.selectedTarget.isNode && !this.selectedTarget.isMerged ? this.selectedTarget.hasServerList : false;
            this.isWAS = this.selectedTarget.isWAS;
            this.node = (target.isNode === true ? this.serverMapData.getNodeData(target.node[0]) as INodeInfo : null);
            this.cd.detectChanges();
        });
    }

    private initKeyword(): void {
        const hasKeyword = this.newUrlStateNotificationService.getPrevPageUrlInfo().queryParams.has(UrlPathId.URLPATTERN);
        if (hasKeyword) {
            this.filterKeyword = this.newUrlStateNotificationService.getPrevPageUrlInfo().queryParams.get(UrlPathId.URLPATTERN);
            this.filterKeyword = decodeURIComponent(this.filterKeyword);
        }
    }

    set isInfoPerServerShow(show: boolean) {
        this._isInfoPerServerShow = show;
        this.spreadAngleIndicator = show ? 'right' : 'left';
    }

    get isInfoPerServerShow(): boolean {
        return this._isInfoPerServerShow;
    }

    onClickViewServer(): void {
        this.analyticsService.trackEvent(TRACKED_EVENT_LIST.SHOW_SERVER_LIST);
        this.isInfoPerServerShow = !this.isInfoPerServerShow;
        this.messageQueueService.sendMessage({
            to: MESSAGE_TO.SERVER_MAP_DISABLE,
            param: this.isInfoPerServerShow
        });
        this.storeHelperService.dispatch(new Actions.ChangeInfoPerServerVisibleState(this.isInfoPerServerShow));
    }

    onClickOpenInspector(): void {
        this.analyticsService.trackEvent(TRACKED_EVENT_LIST.OPEN_INSPECTOR);
        combineLatest(
            this.newUrlStateNotificationService.onUrlStateChange$.pipe(
                map((urlService: NewUrlStateNotificationService) => urlService.isRealTimeMode())
            ),
            this.storeHelperService.getAgentSelection(this.unsubscribe)
        ).pipe(
            take(1),
        ).subscribe(([isRealTimeMode, selectedAgent]: [boolean, string]) => {
            this.urlRouteManagerService.openInspectorPage(isRealTimeMode, selectedAgent);
        });
    }

    onCleanKeyword(): void {
        this.filterKeyword = '';
        this.onFilterByUrlParttern();
    }

    onFilterByUrlParttern(): void {
        const startPath = this.newUrlStateNotificationService.getStartPath();
        const applicationPath = this.newUrlStateNotificationService.getPathValue(UrlPathId.APPLICATION).getUrlStr();
        const baseUrl = [startPath, applicationPath];
        const finalUrl = this.newUrlStateNotificationService.hasValue(UrlPathId.AGENT_ID) ? [...baseUrl, this.newUrlStateNotificationService.getPathValue(UrlPathId.AGENT_ID)] : baseUrl;

        this.urlRouteManagerService.moveOnPage({
            url: finalUrl,
            queryParam: { urlPattern: encodeURIComponent(this.filterKeyword)}
        });
    }
}
