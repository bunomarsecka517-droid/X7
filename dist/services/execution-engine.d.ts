interface ExecutionResult {
    success: boolean;
    txHash?: string;
    profit?: number;
    gasUsed?: number;
    error?: string;
}
declare class ExecutionEngine {
    private providers;
    private signer;
    private pimlicoUrl;
    private pimlicoApiKey;
    private executionLog;
    private retryAttempts;
    private retryDelay;
    constructor(rpcUrls: {
        [key: string]: string;
    }, privateKey: string, pimlicoApiKey: string);
    executeViaFlashbots(transactions: any[], chain?: string): Promise<ExecutionResult>;
    private executeViaStandardRPC;
    estimateGas(tx: any, chain: string): Promise<number>;
}
export default ExecutionEngine;
//# sourceMappingURL=execution-engine.d.ts.map