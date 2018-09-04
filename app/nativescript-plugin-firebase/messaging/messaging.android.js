"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var firebase_common_1 = require("../firebase-common");
var appModule = require("tns-core-modules/application");
var application = require("tns-core-modules/application/application");
var _launchNotification = null;
function init(arg) {
    if (arg.onMessageReceivedCallback !== undefined) {
        addOnMessageReceivedCallback(arg.onMessageReceivedCallback);
    }
    if (arg.onPushTokenReceivedCallback !== undefined) {
        addOnPushTokenReceivedCallback(arg.onPushTokenReceivedCallback);
    }
}
exports.init = init;
function onAppModuleLaunchEvent(args) {
    org.nativescript.plugins.firebase.FirebasePluginLifecycleCallbacks.registerCallbacks(appModule.android.nativeApp);
    var intent = args.android;
    var isLaunchIntent = "android.intent.action.VIEW" === intent.getAction();
    if (!isLaunchIntent) {
        var extras = intent.getExtras();
        // filter out any rubbish that doesn't have a 'from' key
        if (extras !== null && extras.keySet().contains("from")) {
            var result_1 = {
                foreground: false,
                data: {}
            };
            var iterator = extras.keySet().iterator();
            while (iterator.hasNext()) {
                var key = iterator.next();
                if (key !== "from" && key !== "collapse_key") {
                    result_1[key] = extras.get(key);
                    result_1.data[key] = extras.get(key);
                }
            }
            if (firebase_common_1.firebase._receivedNotificationCallback === null) {
                _launchNotification = result_1;
            }
            else {
                // add a little delay just to make sure clients alerting this message will see it as the UI needs to settle
                setTimeout(function () {
                    firebase_common_1.firebase._receivedNotificationCallback(result_1);
                });
            }
        }
    }
}
exports.onAppModuleLaunchEvent = onAppModuleLaunchEvent;
function getCurrentPushToken() {
    return new Promise(function (resolve, reject) {
        try {
            if (typeof (com.google.firebase.messaging || com.google.firebase.iid) === "undefined") {
                reject("Uncomment firebase-messaging in the plugin's include.gradle first");
                return;
            }
            resolve(com.google.firebase.iid.FirebaseInstanceId.getInstance().getToken());
        }
        catch (ex) {
            console.log("Error in firebase.getCurrentPushToken: " + ex);
            reject(ex);
        }
    });
}
exports.getCurrentPushToken = getCurrentPushToken;
function addOnMessageReceivedCallback(callback) {
    return new Promise(function (resolve, reject) {
        try {
            if (typeof (com.google.firebase.messaging) === "undefined") {
                reject("Uncomment firebase-messaging in the plugin's include.gradle first");
                return;
            }
            firebase_common_1.firebase._receivedNotificationCallback = callback;
            org.nativescript.plugins.firebase.FirebasePlugin.setOnNotificationReceivedCallback(new org.nativescript.plugins.firebase.FirebasePluginListener({
                success: function (notification) {
                    callback(JSON.parse(notification));
                }
            }));
            // if the app was launched from a notification, process it now
            if (_launchNotification !== null) {
                callback(_launchNotification);
                _launchNotification = null;
            }
            resolve();
        }
        catch (ex) {
            console.log("Error in firebase.addOnMessageReceivedCallback: " + ex);
            reject(ex);
        }
    });
}
exports.addOnMessageReceivedCallback = addOnMessageReceivedCallback;
function addOnPushTokenReceivedCallback(callback) {
    return new Promise(function (resolve, reject) {
        try {
            if (typeof (com.google.firebase.messaging) === "undefined") {
                reject("Uncomment firebase-messaging in the plugin's include.gradle first");
                return;
            }
            org.nativescript.plugins.firebase.FirebasePlugin.setOnPushTokenReceivedCallback(new org.nativescript.plugins.firebase.FirebasePluginListener({
                success: function (token) {
                    callback(token);
                },
                error: function (err) {
                    console.log("addOnPushTokenReceivedCallback error: " + err);
                }
            }));
            resolve();
        }
        catch (ex) {
            console.log("Error in firebase.addOnPushTokenReceivedCallback: " + ex);
            reject(ex);
        }
    });
}
exports.addOnPushTokenReceivedCallback = addOnPushTokenReceivedCallback;
function unregisterForPushNotifications() {
    return Promise.reject("Not supported on Android");
}
exports.unregisterForPushNotifications = unregisterForPushNotifications;
function subscribeToTopic(topicName) {
    return new Promise(function (resolve, reject) {
        try {
            if (typeof (com.google.firebase.messaging) === "undefined") {
                reject("Uncomment firebase-messaging in the plugin's include.gradle first");
                return;
            }
            var onCompleteListener = new com.google.android.gms.tasks.OnCompleteListener({
                onComplete: function (task) { return task.isSuccessful() ? resolve() : reject(task.getException() && task.getException().getReason ? task.getException().getReason() : task.getException()); }
            });
            com.google.firebase.messaging.FirebaseMessaging.getInstance()
                .subscribeToTopic(topicName)
                .addOnCompleteListener(onCompleteListener);
        }
        catch (ex) {
            console.log("Error in firebase.subscribeToTopic: " + ex);
            reject(ex);
        }
    });
}
exports.subscribeToTopic = subscribeToTopic;
function unsubscribeFromTopic(topicName) {
    return new Promise(function (resolve, reject) {
        try {
            if (typeof (com.google.firebase.messaging) === "undefined") {
                reject("Uncomment firebase-messaging in the plugin's include.gradle first");
                return;
            }
            var onCompleteListener = new com.google.android.gms.tasks.OnCompleteListener({
                onComplete: function (task) { return task.isSuccessful() ? resolve() : reject(task.getException() && task.getException().getReason ? task.getException().getReason() : task.getException()); }
            });
            com.google.firebase.messaging.FirebaseMessaging.getInstance()
                .unsubscribeFromTopic(topicName)
                .addOnCompleteListener(onCompleteListener);
        }
        catch (ex) {
            console.log("Error in firebase.unsubscribeFromTopic: " + ex);
            reject(ex);
        }
    });
}
exports.unsubscribeFromTopic = unsubscribeFromTopic;
function areNotificationsEnabled() {
    var androidSdkVersion = android.os.Build.VERSION.SDK_INT;
    if (androidSdkVersion >= 24) { // android.os.Build.VERSION_CODES.N
        return android.support.v4.app.NotificationManagerCompat.from(application.android.currentContext).areNotificationsEnabled();
    }
    else {
        console.log("NotificationManagerCompat.areNotificationsEnabled() is not supported in Android SDK VERSION " + androidSdkVersion);
        return true;
    }
}
exports.areNotificationsEnabled = areNotificationsEnabled;
