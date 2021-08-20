let imports = {};
imports['__wbindgen_placeholder__'] = module.exports;
let wasm;
const { cwd } = require('process');
const { TextDecoder } = require(`util`);

let cachedTextDecoder = new TextDecoder('utf-8', { ignoreBOM: true, fatal: true });

cachedTextDecoder.decode();

let cachegetUint8Memory0 = null;
function getUint8Memory0() {
  if (cachegetUint8Memory0 === null || cachegetUint8Memory0.buffer !== wasm.memory.buffer) {
    cachegetUint8Memory0 = new Uint8Array(wasm.memory.buffer);
  }
  return cachegetUint8Memory0;
}

function getStringFromWasm0(ptr, len) {
  return cachedTextDecoder.decode(getUint8Memory0().subarray(ptr, ptr + len));
}

let WASM_VECTOR_LEN = 0;

function passArray8ToWasm0(arg, malloc) {
  const ptr = malloc(arg.length * 1);
  getUint8Memory0().set(arg, ptr / 1);
  WASM_VECTOR_LEN = arg.length;
  return ptr;
}
/**
 */
class Hasher {
  static __wrap(ptr) {
    const obj = Object.create(Hasher.prototype);
    obj.ptr = ptr;

    return obj;
  }

  __destroy_into_raw() {
    const ptr = this.ptr;
    this.ptr = 0;

    return ptr;
  }

  free() {
    const ptr = this.__destroy_into_raw();
    wasm.__wbg_hasher_free(ptr);
  }
  /**
   */
  constructor() {
    var ret = wasm.hasher_new();
    return Hasher.__wrap(ret);
  }
  /**
   * @param {Uint8Array} input
   */
  update(input) {
    var ptr0 = passArray8ToWasm0(input, wasm.__wbindgen_malloc);
    var len0 = WASM_VECTOR_LEN;
    wasm.hasher_update(this.ptr, ptr0, len0);
  }
  /**
   * @param {Uint8Array} output
   */
  digest(output) {
    try {
      var ptr0 = passArray8ToWasm0(output, wasm.__wbindgen_malloc);
      var len0 = WASM_VECTOR_LEN;
      wasm.hasher_digest(this.ptr, ptr0, len0);
    } finally {
      output.set(getUint8Memory0().subarray(ptr0 / 1, ptr0 / 1 + len0));
      wasm.__wbindgen_free(ptr0, len0 * 1);
    }
  }
}
module.exports.Hasher = Hasher;

module.exports.__wbindgen_throw = function (arg0, arg1) {
  throw new Error(getStringFromWasm0(arg0, arg1));
};

const bytes = require('fs').readFileSync(
  './src/services/plugin/test2code/third-party/chromehash/pkg/chromehash_bg.wasm',
);

const wasmModule = new WebAssembly.Module(bytes);
const wasmInstance = new WebAssembly.Instance(wasmModule, imports);
wasm = wasmInstance.exports;
module.exports.__wasm = wasm;
