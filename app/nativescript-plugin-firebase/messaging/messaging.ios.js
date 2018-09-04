"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var application = require("tns-core-modules/application/application");
var applicationSettings = require("tns-core-modules/application-settings");
var utils_1 = require("tns-core-modules/utils/utils");
var platform_1 = require("tns-core-modules/platform/platform");
var utils_2 = require("../utils");
var firebase_common_1 = require("../firebase-common");
var _notificationActionTakenCallback;
var _pendingNotifications = [];
var _pushToken;
var _receivedPushTokenCallback;
var _receivedNotificationCallback = null;
var _registerForRemoteNotificationsRanThisSession = false;
var _userNotificationCenterDelegate;
var _messagingConnected = null;
var _firebaseRemoteMessageDelegate;
// Track whether or not registration for remote notifications was request.
// This way we can suppress the "Allow notifications" consent popup until the listeners are passed in.
var NOTIFICATIONS_REGISTRATION_KEY = "Firebase-RegisterForRemoteNotifications";
function init(arg) {
    if (arg.onMessageReceivedCallback !== undefined || arg.onPushTokenReceivedCallback !== undefined) {
        if (arg.onMessageReceivedCallback !== undefined) {
            addOnMessageReceivedCallback(arg.onMessageReceivedCallback);
        }
        if (arg.onPushTokenReceivedCallback !== undefined) {
            addOnPushTokenReceivedCallback(arg.onPushTokenReceivedCallback);
        }
    }
}
exports.init = init;
function addOnMessageReceivedCallback(callback) {
    return new Promise(function (resolve, reject) {
        try {
            if (typeof (FIRMessaging) === "undefined") {
                reject("Enable FIRMessaging in Podfile first");
                return;
            }
            applicationSettings.setBoolean(NOTIFICATIONS_REGISTRATION_KEY, true);
            _receivedNotificationCallback = callback;
            _registerForRemoteNotifications();
            _processPendingNotifications();
            resolve();
        }
        catch (ex) {
            console.log("Error in firebase.addOnMessageReceivedCallback: " + ex);
            reject(ex);
        }
    });
}
exports.addOnMessageReceivedCallback = addOnMessageReceivedCallback;
function getCurrentPushToken() {
    return new Promise(function (resolve, reject) {
        try {
            if (typeof (FIRMessaging) === "undefined") {
                reject("Enable FIRMessaging in Podfile first");
                return;
            }
            resolve(FIRMessaging.messaging().FCMToken);
        }
        catch (ex) {
            console.log("Error in firebase.getCurrentPushToken: " + ex);
            reject(ex);
        }
    });
}
exports.getCurrentPushToken = getCurrentPushToken;
function unregisterForPushNotifications() {
    return new Promise(function (resolve, reject) {
        try {
            if (typeof (FIRMessaging) === "undefined") {
                reject("Enable FIRMessaging in Podfile first");
                return;
            }
            utils_1.ios.getter(UIApplication, UIApplication.sharedApplication).unregisterForRemoteNotifications();
            applicationSettings.remove(NOTIFICATIONS_REGISTRATION_KEY);
            resolve();
        }
        catch (ex) {
            console.log("Error in firebase.unregisterForPushNotifications: " + ex);
            reject(ex);
        }
    });
}
exports.unregisterForPushNotifications = unregisterForPushNotifications;
function handleRemoteNotification(app, userInfo) {
    var userInfoJSON = utils_2.firebaseUtils.toJsObject(userInfo);
    var aps = userInfo.objectForKey("aps");
    if (aps !== null) {
        var alrt = aps.objectForKey("alert");
        if (alrt !== null && alrt.objectForKey) {
            userInfoJSON.title = alrt.objectForKey("title");
            userInfoJSON.body = alrt.objectForKey("body");
        }
    }
    _pendingNotifications.push(userInfoJSON);
    userInfoJSON.foreground = app.applicationState === 0 /* Active */;
    if (_receivedNotificationCallback !== null) {
        _processPendingNotifications();
    }
}
exports.handleRemoteNotification = handleRemoteNotification;
function addOnPushTokenReceivedCallback(callback) {
    return new Promise(function (resolve, reject) {
        try {
            if (typeof (FIRMessaging) === "undefined") {
                reject("Enable FIRMessaging in Podfile first");
                return;
            }
            _receivedPushTokenCallback = callback;
            // may already be present
            if (_pushToken) {
                callback(_pushToken);
            }
            applicationSettings.setBoolean(NOTIFICATIONS_REGISTRATION_KEY, true);
            _registerForRemoteNotifications();
            _processPendingNotifications();
            resolve();
        }
        catch (ex) {
            console.log("Error in firebase.addOnPushTokenReceivedCallback: " + ex);
            reject(ex);
        }
    });
}
exports.addOnPushTokenReceivedCallback = addOnPushTokenReceivedCallback;
function addBackgroundRemoteNotificationHandler(appDelegate) {
    // appDelegate.prototype.app
    appDelegate.prototype.applicationDidReceiveRemoteNotificationFetchCompletionHandler = function (app, notification, completionHandler) {
        // Pass notification to auth and check if they can handle it (in case phone auth is being used), see https://firebase.google.com/docs/auth/ios/phone-auth
        if (firebase_common_1.firebase._configured && FIRAuth.auth().canHandleNotification(notification)) {
            completionHandler(1 /* NoData */);
            return;
        }
        completionHandler(0 /* NewData */);
        handleRemoteNotification(app, notification);
    };
}
exports.addBackgroundRemoteNotificationHandler = addBackgroundRemoteNotificationHandler;
function registerForInteractivePush(model) {
    var nativeActions = [];
    model.iosSettings.interactiveSettings.actions.forEach((function (action) {
        var notificationActionOptions = action.options ? action.options.valueOf() : UNNotificationActionOptionNone;
        var actionType = action.type || "button";
        var nativeAction;
        if (actionType === "input") {
            nativeAction = UNTextInputNotificationAction.actionWithIdentifierTitleOptionsTextInputButtonTitleTextInputPlaceholder(action.identifier, action.title, notificationActionOptions, action.submitLabel || "Submit", action.placeholder);
        }
        else if (actionType === "button") {
            nativeAction = UNNotificationAction.actionWithIdentifierTitleOptions(action.identifier, action.title, notificationActionOptions);
        }
        else {
            console.log("Unsupported action type: " + action.type);
        }
        nativeActions.push(nativeAction);
    }));
    var actions = NSArray.arrayWithArray(nativeActions);
    var nativeCategories = [];
    model.iosSettings.interactiveSettings.categories.forEach(function (category) {
        var nativeCategory = UNNotificationCategory.categoryWithIdentifierActionsIntentIdentifiersOptions(category.identifier, actions, null, null);
        nativeCategories.push(nativeCategory);
    });
    var center = utils_1.ios.getter(UNUserNotificationCenter, UNUserNotificationCenter.currentNotificationCenter);
    var nsSetCategories = new NSSet(nativeCategories);
    center.setNotificationCategories(nsSetCategories);
    if (model.onNotificationActionTakenCallback) {
        _addOnNotificationActionTakenCallback(model.onNotificationActionTakenCallback);
    }
}
exports.registerForInteractivePush = registerForInteractivePush;
function prepAppDelegate() {
    // see https://github.com/EddyVerbruggen/nativescript-plugin-firebase/issues/178 for why we're not using a constant here
    _addObserver("com.firebase.iid.notif.refresh-token", function (notification) { return exports.onTokenRefreshNotification(notification.object); });
    _addObserver(UIApplicationDidFinishLaunchingNotification, function (appNotification) {
        if (applicationSettings.getBoolean(NOTIFICATIONS_REGISTRATION_KEY, false)) {
            _registerForRemoteNotifications();
        }
    });
    _addObserver(UIApplicationDidBecomeActiveNotification, function (appNotification) {
        _processPendingNotifications();
        if (!_messagingConnected) {
            _messagingConnectWithCompletion();
        }
    });
    _addObserver(UIApplicationDidEnterBackgroundNotification, function (appNotification) {
        // Firebase notifications (FCM)
        if (_messagingConnected) {
            FIRMessaging.messaging().disconnect();
        }
    });
    _addObserver(UIApplicationWillEnterForegroundNotification, function (appNotification) {
        // Firebase notifications (FCM)
        if (_messagingConnected !== null) {
            FIRMessaging.messaging().connectWithCompletion(function (error) {
                if (!error) {
                    _messagingConnected = true;
                }
            });
        }
    });
}
exports.prepAppDelegate = prepAppDelegate;
function subscribeToTopic(topicName) {
    return new Promise(function (resolve, reject) {
        try {
            if (typeof (FIRMessaging) === "undefined") {
                reject("Enable FIRMessaging in Podfile first");
                return;
            }
            FIRMessaging.messaging().subscribeToTopicCompletion(topicName, function (error) {
                error ? reject(error.localizedDescription) : resolve();
            });
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
            if (typeof (FIRMessaging) === "undefined") {
                reject("Enable FIRMessaging in Podfile first");
                return;
            }
            FIRMessaging.messaging().unsubscribeFromTopicCompletion(topicName, function (error) {
                error ? reject(error.localizedDescription) : resolve();
            });
        }
        catch (ex) {
            console.log("Error in firebase.unsubscribeFromTopic: " + ex);
            reject(ex);
        }
    });
}
exports.unsubscribeFromTopic = unsubscribeFromTopic;
exports.onTokenRefreshNotification = function (token) {
    _pushToken = token;
    if (_receivedPushTokenCallback) {
        _receivedPushTokenCallback(token);
    }
    _messagingConnectWithCompletion();
};
var IosInteractivePushSettings = /** @class */ (function () {
    function IosInteractivePushSettings() {
    }
    return IosInteractivePushSettings;
}());
exports.IosInteractivePushSettings = IosInteractivePushSettings;
var IosInteractiveNotificationActionOptions;
(function (IosInteractiveNotificationActionOptions) {
    IosInteractiveNotificationActionOptions[IosInteractiveNotificationActionOptions["authenticationRequired"] = 1] = "authenticationRequired";
    IosInteractiveNotificationActionOptions[IosInteractiveNotificationActionOptions["destructive"] = 2] = "destructive";
    IosInteractiveNotificationActionOptions[IosInteractiveNotificationActionOptions["foreground"] = 4] = "foreground";
})(IosInteractiveNotificationActionOptions = exports.IosInteractiveNotificationActionOptions || (exports.IosInteractiveNotificationActionOptions = {}));
var IosPushSettings = /** @class */ (function () {
    function IosPushSettings() {
    }
    return IosPushSettings;
}());
exports.IosPushSettings = IosPushSettings;
var PushNotificationModel = /** @class */ (function () {
    function PushNotificationModel() {
    }
    return PushNotificationModel;
}());
exports.PushNotificationModel = PushNotificationModel;
var NotificationActionResponse = /** @class */ (function () {
    function NotificationActionResponse() {
    }
    return NotificationActionResponse;
}());
exports.NotificationActionResponse = NotificationActionResponse;
function areNotificationsEnabled() {
    var app = utils_1.ios.getter(UIApplication, UIApplication.sharedApplication);
    // to check if also the app is registered use app.registeredForRemoteNotifications,
    // this below checks if user has enabled notifications for the app
    return app.currentUserNotificationSettings.types > 0;
}
exports.areNotificationsEnabled = areNotificationsEnabled;
function _registerForRemoteNotifications() {
    var app = utils_1.ios.getter(UIApplication, UIApplication.sharedApplication);
    if (!app) {
        application.on("launch", function () {
            _registerForRemoteNotifications();
        });
        return;
    }
    if (_registerForRemoteNotificationsRanThisSession) {
        return;
    }
    _registerForRemoteNotificationsRanThisSession = true;
    if (parseInt(platform_1.device.osVersion) >= 10) {
        var authorizationOptions = 4 /* Alert */ | 2 /* Sound */ | 1 /* Badge */;
        var curNotCenter = utils_1.ios.getter(UNUserNotificationCenter, UNUserNotificationCenter.currentNotificationCenter);
        curNotCenter.requestAuthorizationWithOptionsCompletionHandler(authorizationOptions, function (granted, error) {
            if (!error) {
                if (app === null) {
                    app = utils_1.ios.getter(UIApplication, UIApplication.sharedApplication);
                }
                if (app !== null) {
                    utils_2.firebaseUtils.invokeOnRunLoop(function () {
                        app.registerForRemoteNotifications();
                    });
                }
            }
            else {
                console.log("Error requesting push notification auth: " + error);
            }
        });
        _userNotificationCenterDelegate = UNUserNotificationCenterDelegateImpl.new().initWithCallback(function (unnotification, actionIdentifier, inputText) {
            // if the app is in the foreground then this method will receive the notification
            // if the app is in the background, and user has responded to interactive notification, then this method will receive the notification
            // if the app is in the background, and user views a notification, applicationDidReceiveRemoteNotificationFetchCompletionHandler will receive it
            var userInfo = unnotification.request.content.userInfo;
            var userInfoJSON = utils_2.firebaseUtils.toJsObject(userInfo);
            if (actionIdentifier && _notificationActionTakenCallback) {
                // TODO: THIS CODE DOWN IS DUPLICATE, REFACTOR!!!!
                // move the most relevant properties (if set) so it's according to the TS definition and aligned with Android
                if (userInfoJSON.aps && userInfoJSON.aps.alert) {
                    userInfoJSON.title = userInfoJSON.aps.alert.title;
                    userInfoJSON.body = userInfoJSON.aps.alert.body;
                }
                // also, to make the ts.d happy copy all properties to a data element
                if (!userInfoJSON.hasOwnProperty('data')) {
                    userInfoJSON.data = {};
                }
                Object.keys(userInfoJSON).forEach(function (key) {
                    if (key !== 'data')
                        userInfoJSON.data[key] = userInfoJSON[key];
                });
                // cleanup
                userInfoJSON.aps = undefined;
                // TODO: THIS CODE UP IS DUPLICATE, REFACTOR!!!!
                _notificationActionTakenCallback(actionIdentifier, userInfoJSON, inputText);
            }
            userInfoJSON.foreground = true;
            _pendingNotifications.push(userInfoJSON);
            if (_receivedNotificationCallback !== null) {
                _processPendingNotifications();
            }
        });
        curNotCenter.delegate = _userNotificationCenterDelegate;
        _firebaseRemoteMessageDelegate = FIRMessagingDelegateImpl.new().initWithCallback(function (appDataDictionary) {
            var userInfoJSON = utils_2.firebaseUtils.toJsObject(appDataDictionary);
            _pendingNotifications.push(userInfoJSON);
            var asJs = utils_2.firebaseUtils.toJsObject(appDataDictionary.objectForKey("notification"));
            if (asJs) {
                userInfoJSON.title = asJs.title;
                userInfoJSON.body = asJs.body;
            }
            var app = utils_1.ios.getter(UIApplication, UIApplication.sharedApplication);
            if (app.applicationState === 0 /* Active */) {
                userInfoJSON.foreground = true;
                if (_receivedNotificationCallback !== null) {
                    _processPendingNotifications();
                }
            }
            else {
                userInfoJSON.foreground = false;
            }
        });
        FIRMessaging.messaging().delegate = _firebaseRemoteMessageDelegate;
    }
    else {
        var notificationTypes = 4 /* Alert */ | 1 /* Badge */ | 2 /* Sound */ | 1 /* Background */;
        var notificationSettings = UIUserNotificationSettings.settingsForTypesCategories(notificationTypes, null);
        utils_2.firebaseUtils.invokeOnRunLoop(function () {
            app.registerForRemoteNotifications(); // prompts the user to accept notifications
        });
        app.registerUserNotificationSettings(notificationSettings);
    }
}
function _messagingConnectWithCompletion() {
    return new Promise(function (resolve, reject) {
        FIRMessaging.messaging().connectWithCompletion(function (error) {
            if (error) {
                // this is not fatal and it scares the hell out of ppl so not logging it
                // console.log("Firebase was unable to connect to FCM. Error: " + error);
                return reject(error);
            }
            _messagingConnected = true;
            resolve();
        });
    });
}
function _addOnNotificationActionTakenCallback(callback) {
    return new Promise(function (resolve, reject) {
        try {
            if (typeof (FIRMessaging) === "undefined") {
                reject("Enable FIRMessaging in Podfile first");
                return;
            }
            _notificationActionTakenCallback = callback;
            resolve();
        }
        catch (ex) {
            console.log("Error in firebase._addOnNotificationActionTakenCallback: " + ex);
            reject(ex);
        }
    });
}
function _processPendingNotifications() {
    var app = utils_1.ios.getter(UIApplication, UIApplication.sharedApplication);
    if (!app) {
        application.on("launch", function () {
            _processPendingNotifications();
        });
        return;
    }
    if (_receivedNotificationCallback !== null) {
        var _loop_1 = function (p) {
            var userInfoJSON = _pendingNotifications[p];
            // move the most relevant properties (if set) so it's according to the TS definition and aligned with Android
            if (userInfoJSON.aps && userInfoJSON.aps.alert) {
                userInfoJSON.title = userInfoJSON.aps.alert.title;
                userInfoJSON.body = userInfoJSON.aps.alert.body;
            }
            // also, to make the ts.d happy copy all properties to a data element
            if (!userInfoJSON.hasOwnProperty('data')) {
                userInfoJSON.data = {};
            }
            Object.keys(userInfoJSON).forEach(function (key) {
                if (key !== 'data')
                    userInfoJSON.data[key] = userInfoJSON[key];
            });
            // cleanup
            userInfoJSON.aps = undefined;
            _receivedNotificationCallback(userInfoJSON);
        };
        for (var p in _pendingNotifications) {
            _loop_1(p);
        }
        _pendingNotifications = [];
        if (app.applicationState === 0 /* Active */) {
            app.applicationIconBadgeNumber = 0;
        }
    }
}
function _addObserver(eventName, callback) {
    var queue = utils_1.ios.getter(NSOperationQueue, NSOperationQueue.mainQueue);
    return utils_1.ios.getter(NSNotificationCenter, NSNotificationCenter.defaultCenter).addObserverForNameObjectQueueUsingBlock(eventName, null, queue, callback);
}
// see https://developer.apple.com/reference/usernotifications/unusernotificationcenterdelegate?language=objc
var UNUserNotificationCenterDelegateImpl = /** @class */ (function (_super) {
    __extends(UNUserNotificationCenterDelegateImpl, _super);
    function UNUserNotificationCenterDelegateImpl() {
        return _super !== null && _super.apply(this, arguments) || this;
    }
    UNUserNotificationCenterDelegateImpl.new = function () {
        if (UNUserNotificationCenterDelegateImpl.ObjCProtocols.length === 0 && typeof (UNUserNotificationCenterDelegate) !== "undefined") {
            UNUserNotificationCenterDelegateImpl.ObjCProtocols.push(UNUserNotificationCenterDelegate);
        }
        return _super.new.call(this);
    };
    UNUserNotificationCenterDelegateImpl.prototype.initWithCallback = function (callback) {
        this.callback = callback;
        return this;
    };
    UNUserNotificationCenterDelegateImpl.prototype.userNotificationCenterWillPresentNotificationWithCompletionHandler = function (center, notification, completionHandler) {
        console.log(">>>>>>>>>>> Handle push from foreground");
        var userInfo = notification.request.content.userInfo;
        var userInfoJSON = utils_2.firebaseUtils.toJsObject(userInfo);
        if (userInfoJSON["gcm.notification.showWhenInForeground"] === "true") {
            // don't invoke the callback here, since the app shouldn't fi. navigate to a new page unless the user pressed the notification
            completionHandler(4 /* Alert */ | 2 /* Sound */ | 1 /* Badge */);
        }
        else {
            // invoke the callback here, since in this case 'userNotificationCenterDidReceiveNotificationResponseWithCompletionHandler' doesn't run
            this.callback(notification);
            completionHandler(0);
        }
    };
    UNUserNotificationCenterDelegateImpl.prototype.userNotificationCenterDidReceiveNotificationResponseWithCompletionHandler = function (center, response, completionHandler) {
        console.log("Notification action response");
        console.log(response);
        this.callback(response.notification, response.actionIdentifier, response.userText);
        completionHandler();
    };
    UNUserNotificationCenterDelegateImpl.ObjCProtocols = [];
    return UNUserNotificationCenterDelegateImpl;
}(NSObject));
var FIRMessagingDelegateImpl = /** @class */ (function (_super) {
    __extends(FIRMessagingDelegateImpl, _super);
    function FIRMessagingDelegateImpl() {
        return _super !== null && _super.apply(this, arguments) || this;
    }
    FIRMessagingDelegateImpl.new = function () {
        if (FIRMessagingDelegateImpl.ObjCProtocols.length === 0 && typeof (FIRMessagingDelegate) !== "undefined") {
            FIRMessagingDelegateImpl.ObjCProtocols.push(FIRMessagingDelegate);
        }
        return _super.new.call(this);
    };
    FIRMessagingDelegateImpl.prototype.initWithCallback = function (callback) {
        this.callback = callback;
        return this;
    };
    FIRMessagingDelegateImpl.prototype.messagingDidReceiveMessage = function (messaging, remoteMessage) {
        console.log(">> fcm message received");
        this.callback(remoteMessage.appData);
    };
    FIRMessagingDelegateImpl.prototype.messagingDidReceiveRegistrationToken = function (messaging, fcmToken) {
        console.log(">> fcmToken received: " + fcmToken);
        exports.onTokenRefreshNotification(fcmToken);
    };
    FIRMessagingDelegateImpl.ObjCProtocols = [];
    return FIRMessagingDelegateImpl;
}(NSObject));
