export declare function init(arg: any): void;
export declare function onAppModuleLaunchEvent(args: any): void;
export declare function getCurrentPushToken(): Promise<{}>;
export declare function addOnMessageReceivedCallback(callback: any): Promise<{}>;
export declare function addOnPushTokenReceivedCallback(callback: any): Promise<{}>;
export declare function unregisterForPushNotifications(): Promise<never>;
export declare function subscribeToTopic(topicName: any): Promise<{}>;
export declare function unsubscribeFromTopic(topicName: any): Promise<{}>;
export declare function areNotificationsEnabled(): any;
