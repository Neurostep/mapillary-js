/// <reference path="../../typings/rest/rest.d.ts" />

import * as rest from "rest";
import * as mime from "rest/interceptor/mime";

export class APIc {
    private clientId: string;
    private httpsUrl: string;
    private client: rest.Client;

    constructor (clientId: string) {
        this.clientId = clientId;
        this.httpsUrl = "https://a.mapillary.com/v2/";
        this.client = rest.wrap(mime);
    };

    public callApi(path: string): rest.ResponsePromise {
        return this.client(this.httpsUrl + path + "?client_id=" + this.clientId);
    }
};

export default APIc