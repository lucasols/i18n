import { __, __jsx, __p, __pjsx } from '../../../../../src/main';

export function getChatMenuLabels() {
  return [
    __`Direct Messages`,
    __`You have no direct messages`,
    __`Bookmarked`,
    __`You have no bookmarked conversations`,
    __`Remove bookmark`,
  ];
}

export function getUnreadLabel(count: number) {
  return __p(count)`You have # unread messages`;
}

export function getWelcomeMessage(name: string, isFormal: boolean) {
  return isFormal ?
      __`Hello ${name}, welcome back!~~formal`
    : __`Hello ${name}, welcome back!`;
}

export function getMemberLink(name: string) {
  return __jsx`Message ${(<strong>{name}</strong>)} directly`;
}

export function getFilesLabel(count: number, folder: string) {
  return __pjsx(count)`# files in ${(<em>{folder}</em>)}`;
}

export function getChannelSummary(channel: string, members: number) {
  return __`${channel} has ${__p(members)`# members`}`;
}
