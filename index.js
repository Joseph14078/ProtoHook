var PH = function(ref, func) {
    if (typeof func != "undefined")
        return PH.hook(ref, func);

    var protoKeys = Object.keys(ref.prototype);

    for (var i = 0; i < protoKeys.length; i++) {
        var key = protoKeys[i];
        PH.hook(ref, key);
    }
};

PH._run = function(ref, funcKey, step,  obj, args, result) {
    if (typeof PH._binds.get(ref) == 'undefined') return;    
    var refBinds = PH._binds.get(ref);
    
    if (typeof refBinds[funcKey] == 'undefined') return;
    var funcBinds = refBinds[funcKey];
    
    if (typeof funcBinds[step] == 'undefined') return;
    var stepBinds = funcBinds[step];

    var stepBindsKeys = Object.keys(stepBinds);
    for (var i = 0; i < stepBindsKeys.length; i++) {
        var key = stepBindsKeys[i];
        stepBinds[key](obj, args, result);
    }
};

PH._bindNum = 0;
PH._binds = new Map();

PH.bind = function(ref, func, step, callback) {
    if (typeof PH._binds.get(ref) == 'undefined')
        PH._binds.set(ref, {});
    var refBinds = PH._binds.get(ref);

    var funcKey = PH._getFuncKey(ref, func);
    if (typeof refBinds[funcKey] == 'undefined')
        refBinds[funcKey] = {};
    var funcBinds = refBinds[funcKey];

    if (typeof funcBinds[step] == 'undefined')
        funcBinds[step] = {};
    var stepBinds = funcBinds[step];
    step = step || 'end';

    stepBinds[PH._bindNum] = callback;

    return PH._bindNum++;
};

PH.unbind = function(ref, func, step, bindNum) {
    if (typeof PH._binds.get(ref) == 'undefined')
        PH._binds.set(ref, {});
    var refBinds = PH._binds.get(ref);

    var funcKey = PH._getFuncKey(ref, func);
    if (typeof refBinds[funcKey] == 'undefined')
        refBinds[funcKey] = {};
    var funcBinds = refBinds[funcKey];

    if (typeof funcBinds[step] == 'undefined')
        funcBinds[step] = {};
    var stepBinds = funcBinds[step];

    delete stepBinds[bindNum];
    
    if (Object.keys(stepBinds).length == 0)
        delete funcBinds[step];

    if (Object.keys(funcBinds).length == 0)
        delete refBinds[funcKey];

    if (Object.keys(refBinds).length == 0)
        delete PH._binds.delete(ref);
};

PH._getFuncKey = function(ref, func) {
    if (typeof func == "string") return func;

    var funcKey;
    var protoKeys = Object.keys(ref.prototype);

    for (var i = 0; i < protoKeys.length; i++) {
        var key = protoKeys[i];
        if (ref.prototype[key] === func) {
            funcKey = key;
            break;
        }
    }
    return funcKey;
}

PH.hook = function(ref, func) {
    var funcKey;
    if (typeof func == "string") {
        funcKey = func;
        func = ref.prototype[funcKey];
    } else funcKey = PH._getFuncKey(ref, func);
    if (!funcKey) return;

    if (ref.prototype[funcKey]._isPH) return;

    ref.prototype[funcKey] = function() {
        PH._run(ref, funcKey, 'start', this, arguments, undefined);
        var result = func.apply(this, arguments);
        PH._run(ref, funcKey, 'end', this, arguments, result);
    }

    ref.prototype[funcKey]._isPH = true;
};

// UMD (Universal Module Definition)
(function(root) {
	if (typeof define === 'function' && define.amd) {
		// AMD
		define([], function () {
			return PH;
		});
	} else if (typeof module !== 'undefined' && typeof exports === 'object') {
		// Node.js
		module.exports = PH;
	} else if (root !== undefined) {
		// Global variable
		root.PH = PH;
	}
})(this);