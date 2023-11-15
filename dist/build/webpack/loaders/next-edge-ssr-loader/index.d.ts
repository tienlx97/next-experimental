import type webpack from 'webpack';
import type { SizeLimit } from '../../../../../types';
export type EdgeSSRLoaderQuery = {
    absolute500Path: string;
    absoluteAppPath: string;
    absoluteDocumentPath: string;
    absoluteErrorPath: string;
    absolutePagePath: string;
    buildId: string;
    dev: boolean;
    isServerComponent: boolean;
    page: string;
    stringifiedConfig: string;
    appDirLoader?: string;
    pagesType: 'app' | 'pages' | 'root';
    sriEnabled: boolean;
    incrementalCacheHandlerPath?: string;
    preferredRegion: string | string[] | undefined;
    middlewareConfig: string;
    serverActions?: {
        bodySizeLimit?: SizeLimit;
        allowedOrigins?: string[];
    };
};
declare const edgeSSRLoader: webpack.LoaderDefinitionFunction<EdgeSSRLoaderQuery>;
export default edgeSSRLoader;
