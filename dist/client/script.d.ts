import React from 'react';
import type { ScriptHTMLAttributes } from 'react';
export interface ScriptProps extends ScriptHTMLAttributes<HTMLScriptElement> {
    strategy?: 'afterInteractive' | 'lazyOnload' | 'beforeInteractive' | 'worker';
    id?: string;
    onLoad?: (e: any) => void;
    onReady?: () => void | null;
    onError?: (e: any) => void;
    children?: React.ReactNode;
    stylesheets?: string[];
}
/**
 * @deprecated Use `ScriptProps` instead.
 */
export type Props = ScriptProps;
export declare function handleClientScriptLoad(props: ScriptProps): void;
export declare function initScriptLoader(scriptLoaderItems: ScriptProps[]): void;
declare function Script(props: ScriptProps): JSX.Element | null;
export default Script;
