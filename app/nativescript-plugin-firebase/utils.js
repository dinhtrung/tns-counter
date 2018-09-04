"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var firebase_common_1 = require("./firebase-common");
var types_1 = require("tns-core-modules/utils/types");
var Utils = /** @class */ (function () {
    function Utils() {
        this.invokeOnRunLoop = (function () {
            var runloop = CFRunLoopGetMain();
            return function (func) {
                CFRunLoopPerformBlock(runloop, kCFRunLoopDefaultMode, func);
                CFRunLoopWakeUp(runloop);
            };
        })();
    }
    Utils.prototype.toJsObject = function (objCObj) {
        if (objCObj === null || typeof objCObj !== "object") {
            return objCObj;
        }
        var node, key, i, l, oKeyArr = objCObj.allKeys;
        if (oKeyArr === undefined) {
            // array
            node = [];
            for (i = 0, l = objCObj.count; i < l; i++) {
                key = objCObj.objectAtIndex(i);
                node.push(this.toJsObject(key));
            }
        }
        else {
            // object
            node = {};
            for (i = 0, l = oKeyArr.count; i < l; i++) {
                key = oKeyArr.objectAtIndex(i);
                var val = objCObj.valueForKey(key);
                // Firestore can store nulls
                if (val === null) {
                    node[key] = null;
                    continue;
                }
                switch (types_1.getClass(val)) {
                    case 'NSArray':
                    case 'NSMutableArray':
                        node[key] = this.toJsObject(val);
                        break;
                    case 'NSDictionary':
                    case 'NSMutableDictionary':
                        node[key] = this.toJsObject(val);
                        break;
                    case 'String':
                        node[key] = String(val);
                        break;
                    case 'Boolean':
                        node[key] = val;
                        break;
                    case 'Number':
                    case 'NSDecimalNumber':
                        node[key] = Number(String(val));
                        break;
                    case 'Date':
                        node[key] = new Date(val);
                        break;
                    case 'FIRTimestamp':
                        node[key] = val.dateValue();
                        break;
                    case 'FIRDocumentReference':
                        var path = val.path;
                        var lastSlashIndex = path.lastIndexOf("/");
                        node[key] = firebase_common_1.firebase.firestore._getDocumentReference(val, path.substring(0, lastSlashIndex), path.substring(lastSlashIndex + 1));
                        break;
                    case 'FIRGeoPoint':
                        node[key] = firebase_common_1.firebase.firestore.GeoPoint(val.latitude, val.longitude);
                        break;
                    default:
                        console.log("Please report this at https://github.com/EddyVerbruggen/nativescript-plugin-firebase/issues: iOS toJsObject is missing a converter for class '" + types_1.getClass(val) + "'. Casting to String as a fallback.");
                        node[key] = String(val);
                }
            }
        }
        return node;
    };
    return Utils;
}());
exports.Utils = Utils;
exports.firebaseUtils = new Utils();
