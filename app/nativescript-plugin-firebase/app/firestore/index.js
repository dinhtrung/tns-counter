"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var firebase = require("../../firebase");
var firestore;
(function (firestore) {
    var Firestore = /** @class */ (function () {
        function Firestore() {
        }
        Firestore.prototype.collection = function (collectionPath) {
            return firebase.firestore.collection(collectionPath);
        };
        Firestore.prototype.FieldValue = function () {
            return {
                serverTimestamp: function () { return "SERVER_TIMESTAMP"; }
            };
        };
        Firestore.prototype.GeoPoint = function (latitude, longitude) {
            return firebase.firestore.GeoPoint(latitude, longitude);
        };
        Firestore.prototype.runTransaction = function (updateFunction) {
            return firebase.firestore.runTransaction(updateFunction);
        };
        Firestore.prototype.batch = function () {
            return firebase.firestore.batch();
        };
        return Firestore;
    }());
    firestore.Firestore = Firestore;
})(firestore = exports.firestore || (exports.firestore = {}));
