/* @ts-self-types="./sql_guard.d.ts" */
import * as wasm from "./sql_guard_bg.wasm";
import { __wbg_set_wasm } from "./sql_guard_bg.js";

__wbg_set_wasm(wasm);
wasm.__wbindgen_start();
export {
    parse_migration
} from "./sql_guard_bg.js";
