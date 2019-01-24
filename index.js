var _PHGroup = function() {
    this._binds = new Map();
    this._bindsAll = {};
};

_PHGroup.prototype._run = function(ref, funcKey, step,  obj, args, result) {
    if (typeof this._binds.get(ref) == 'undefined') return;    
    var refBinds = this._binds.get(ref);
    
    if (typeof refBinds[funcKey] == 'undefined') return;
    var funcBinds = refBinds[funcKey];
    
    if (typeof funcBinds[step] == 'undefined') return;
    var stepBinds = funcBinds[step];

    var stepBindsKeys = Object.keys(stepBinds);
    for (var i = 0; i < stepBindsKeys.length; i++) {
        var bindKey = stepBindsKeys[i];
        stepBinds[bindKey].callback(result, args, obj);
        if (!isNaN(stepBinds[bindKey].count)) {
            stepBinds[bindKey].count--;
            if (stepBinds[bindKey].count <= 0)
                this._unbindDo(ref, funcKey, step, bindKey);
        }
    }
};

_PHGroup.prototype.bind = function(ref, func, step, callback, count) {
    var funcAndKey = this._findFuncAndKey(ref, func);
    func = funcAndKey[0];
    var funcKey = funcAndKey[1];

    var newFuncDest = this._getNewFuncDest(ref);
    if (!newFuncDest[funcKey]._PHOriginal) this._hook(ref, funcKey);

    if (typeof this._binds.get(ref) == 'undefined')
        this._binds.set(ref, {});
    var refBinds = this._binds.get(ref);
    
    if (typeof refBinds[funcKey] == 'undefined')
        refBinds[funcKey] = {};
    var funcBinds = refBinds[funcKey];

    if (typeof funcBinds[step] == 'undefined')
        funcBinds[step] = {};
    var stepBinds = funcBinds[step];
    step = step || 'end';

    var bindKey = Math.random();

    stepBinds[bindKey] = {
        callback: callback,
        count: count <= 0 ? undefined : count
    };
    this._bindsAll[bindKey] = [ref, funcKey, step];

    return bindKey;
};

_PHGroup.prototype.unbind = function(bindKey) {
    if (typeof this._bindsAll[bindKey] == "undefined") return;

    var bindParams = this._bindsAll[bindKey];
    this._unbindDo(bindParams[0], bindParams[1], bindParams[2], bindKey);
};


_PHGroup.prototype._unbindDo = function(ref, func, step, bindKey) {
    var funcAndKey = this._findFuncAndKey(ref, func);
    func = funcAndKey[0];
    var funcKey = funcAndKey[1];

    if (typeof this._binds.get(ref) == 'undefined')
        this._binds.set(ref, {});
    var refBinds = this._binds.get(ref);

    if (typeof refBinds[funcKey] == 'undefined')
        refBinds[funcKey] = {};
    var funcBinds = refBinds[funcKey];

    if (typeof funcBinds[step] == 'undefined')
        funcBinds[step] = {};
    var stepBinds = funcBinds[step];

    delete stepBinds[bindKey];
    delete this._bindsAll[bindKey];
    
    if (Object.keys(stepBinds).length == 0)
        delete funcBinds[step];

    if (Object.keys(funcBinds).length == 0) {
        delete refBinds[funcKey];
        this._unhook(ref, func);
    }

    if (Object.keys(refBinds).length == 0)
        delete this._binds.delete(ref);
};

_PHGroup.prototype._findKey = function(obj, item) {
    if (typeof item == "string") return item;

    var objKeys = Object.keys(obj);
    for (var i = 0; i < objKeys.length; i++) {
        var key = objKeys[i];
        if (obj[key] === item)
            return key;
    }
};

_PHGroup.prototype._isProto = function(ref) {
    return typeof ref == "function";
};

_PHGroup.prototype._findFuncKey = function(ref, func) {
    if (typeof func == "string") return func;

    var key;
    var isProto = this._isProto(ref);

    // Find key from function (more expensive)
    if (!isProto) {
        key = this._findKey(ref, func);
        if (typeof key != "undefined") return key;

        key = this._findKey(ref.constructor.prototype, func);
        if (typeof key != "undefined") return key;
    } else {
        key = this._findKey(ref.prototype, func);
        if (typeof key != "undefined") return key;
    }
};

_PHGroup.prototype._findFunc = function(ref, key) {
    if (typeof key == "function") return key;

    var func;
    var isProto = this._isProto(ref);

    if (!isProto) {
        func = ref[key];
        if (typeof func != "undefined") return func;
        
        func = ref.constructor.prototype[key];
        if (typeof func != "undefined") return func;
    } else {
        func = ref.prototype[key];
        if (typeof func != "undefined") return func;
    }
};

_PHGroup.prototype._findFuncAndKey = function(ref, func) {
    var funcKey;
    if (typeof func == "string") {
        funcKey = func;
        func = this._findFunc(ref, funcKey);
        if (!func) throw "Could not find function in ref.";
    } else {
        funcKey = this._findFuncKey(ref, func);
        if (!funcKey) throw "Could not find function key in ref.";
    }
    return [func, funcKey];
};

_PHGroup.prototype._getNewFuncDest = function(ref) {
    return this._isProto(ref) ? ref.prototype : ref;
}

_PHGroup.prototype._hook = function(ref, func) {
    var newFuncDest = this._getNewFuncDest(ref);
    var funcAndKey = this._findFuncAndKey(ref, func);
    func = funcAndKey[0];
    var funcKey = funcAndKey[1];
    
    if (newFuncDest[funcKey]._PHOriginal) throw "Function is already hooked.";
    
    var phGroup = this;

    // Replacement will always be stored in ref rather than its prototype
    newFuncDest[funcKey] = function() {
        phGroup._run(ref, funcKey, 'start', this, arguments, undefined);
        var result = func.apply(this, arguments);
        phGroup._run(ref, funcKey, 'end', this, arguments, result);
    };
    newFuncDest[funcKey]._PHOriginal = func;
    newFuncDest[funcKey]._PHGroup = this;
};

_PHGroup.prototype._unhook = function(ref, func) {
    var newFuncDest = this._getNewFuncDest(ref);
    var funcAndKey = this._findFuncAndKey(ref, func);
    func = funcAndKey[0];
    var funcKey = funcAndKey[1];
    
    if (!newFuncDest[funcKey]._PHGroup == this) throw "Cannot unhook function while it is owned by another group.";
    if (!newFuncDest[funcKey]._PHOriginal) throw "Function is not hooked.";

    var funcFromConstructor = !this._isProto(ref) && (ref.constructor.prototype[funcKey] === newFuncDest[funcKey]._PHOriginal);

    if (funcFromConstructor)
        delete newFuncDest[funcKey];
    else
        newFuncDest[funcKey] = newFuncDest[funcKey]._PHOriginal;
};

var PH = new _PHGroup();
PH.Group = _PHGroup();

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