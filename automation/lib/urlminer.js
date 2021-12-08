const _ = require('lodash');
const moment = require('moment');
const debug = require('debug')('parsers:urlminer');

/* remind self: this code is an improvement of librevent which is an improvement of fbtrex,
 * please align */
function attributeLinkByPattern(sectionlist, retval) {
    const first = _.nth(sectionlist, 0);
    const second = _.nth(sectionlist, 1)

    if(first == 'groups') {
        retval.fblinktype = 'groups';
        retval.groupId = second;
        retval.infotype = _.nth(sectionlist, 2);
        retval.authorId = _.nth(sectionlist, 3);
        return true;
    } else if(first == 'stories') {
        retval.fblinktype = 'stories';
        retval.storyId = second;
        return true;
    } else if(first == 'events' && second == 'search') {
        retval.fblinktype = 'events-search';
        retval.query = retval.parsed['?q'];
        retval.quintrex = true;
        return true;
    } else if(first == 'events' && _.isUndefined(second)) { 
        retval.fblinktype = 'events-list';
        retval.quintrex = true;
        return true;
    } else if(first == 'events') {
        retval.fblinktype = 'events';
        retval.eventId = second;
        retval.quintrex = true;
        return true;
    } else if(second == 'events') {
        retval.fblinktype = 'events-page';
        retval.pageId = first;
        retval.quintrex = true;
        return true;
    } else if(first == 'watch') {
        retval.fblinktype = 'watch';
        retval.pageId = second;
        retval.detailId = _.nth(sectionlist, 2);
        return true;
    } else if(first == 'notes') {
        retval.fblinktype = 'notes';
        return true;
    } else if(first == 'donate') {
        retval.fblinktype = 'donate';
        retval.pageId = second;
        return true;
    } else if(first == 'media') {
        // 'https://www.facebook.com/media/set/?vanity=cintia.nalbones&set=a.102707016487578'
        retval.publisherName = retval.parsed["?vanity"];
        retval.galleryId = retval.parsed["set"];
        retval.galleryType = retval.parsed["type"];
        retval.fblinktype = 'gallery'; 
        return true;
    } else if(first == 'hashtag') {
        retval.fblinktype = 'hashtag';
        retval.hashtag = second;
        return true;
    } else if(first == 'ad_center') {
        retval.fblinktype = 'boost';
        return true;
    } else if(first == 'images') {
        retval.fblinktype = 'static';
        return true;
    } else if(_.size(sectionlist) === 1) {
        retval.fblinktype = 'profile';
        retval.profileName = first;
        return true;
    } else if(second == 'posts') {
        retval.fblinktype = 'post';
        retval.profileName = first;
        return true;
    } else if(second == 'videos') {
        retval.fblinktype = 'video';
        retval.profileName = first;
        retval.detailId = _.nth(sectionlist, 2);
        return true;
    }

    debug("Failing in finding %s %s")
    return false;
}

function attributeLinkByFormat(sectionlist, retval) {
    const first = _.nth(sectionlist, 0);
    const second = _.nth(sectionlist, 1);

    if(second == 'photos') {
        /* /MillenniumHiltonNewYorkOneUNPlaza/photos/a.415328151930706/1441157289347782/ */
        retval.fblinktype = 'photo';
        retval.groupId = first;
        retval.albumId = second.replace(/a\./, '');
        retval.authorId = _.nth(sectionlist, 2);
    } else if(first == 'photo.php') {
        /* https://www.facebook.com/photo.php?fbid=10224586748685348&set=a.10202327757704485&type=3 */
        retval.fblinktype = 'photo';
        retval.authorId = retval.parsed['?fbid'];
        retval.photoId = retval.parsed['set'].replace(/a\./, '');
    } else if(first == 'rsrc.php') {
        retval.useless = true;
    } else if(first == 'ufi') {
        //https://www.facebook.com/ufi/reaction/profile/browser/?ft_ent_identifier=Z
        retval.profileId = retval.parsed['av'];
        retval.fblinktype = 'reaction';
    } else if(retval.parsed["?comment_id"] && first == 'people') {
        // https://www.facebook.com/people/Samar-Ibrahim/100009595573209/?comment_id=Y29tbWVudDoxMzc5NDcxMTMzNzEzMDNfMTYxOTQzNDI3NjM4MzM4&__tn__=R*F
        retval.commenterId = _.nth(sectionlist, 2);
        retval.commenterName = second;
        retval.fblinktype = 'comment';
    } else {
        return false;
    }
    return true;
}

module.exports = {
    attributeLinkByFormat,
    attributeLinkByPattern,
};