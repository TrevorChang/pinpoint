import { Action } from '@ngrx/store';

const UPDATE_DIFF_DETAIL_DATA = 'UPDATE_DIFF_DETAIL_DATA';

export class UpdateDiffDetailData implements Action {
    readonly type = UPDATE_DIFF_DETAIL_DATA;
    constructor(public payload: ITransactionDetailData) {}
}

export function Reducer(state: ITransactionDetailData, action: UpdateDiffDetailData): ITransactionDetailData {
    switch ( action.type ) {
        case UPDATE_DIFF_DETAIL_DATA:
            if (state && (state.agentId === action.payload.agentId && state.applicationId === action.payload['applicationId'] && state.transactionId === action.payload.transactionId)) {
                return state;
            } else {
                return action.payload;
            }
        default:
            return state;
    }
}
