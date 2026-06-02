declare class DataIngestService {
    private providers;
    private eventQueue;
    private dataSources;
    constructor(rpcUrls: {
        [key: string]: string;
    });
    startMempoolMonitoring(chains: string[]): Promise<void>;
    monitorOnChainEvents(chains: string[]): Promise<void>;
    getPrices(tokens: string[]): Promise<{
        [key: string]: number;
    }>;
    getEventQueue(): any[];
    clearEventQueue(): void;
}
export default DataIngestService;
//# sourceMappingURL=data-ingest.d.ts.map