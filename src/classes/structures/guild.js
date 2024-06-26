const { validatePermission, getAddonPermission, getColorCode, getChannelId, getResolvableDate, getClient, getVideoQualityMode } = require('../../utils/functions.js');
const scopes = require('../../bitfields/scopes.js');
const GuildManager = require('../managers/guildManager.js');
const GuildMemberManager = require('../managers/guildMemberManager.js');
const inviteManager = require('../managers/inviteManager.js');
const VoiceStateManager = require('../managers/voiceStateManager.js');
const Member = require('./member.js');
const Emoji = require('./emoji.js');
const Role = require('./role.js');
const CategoryChannel = require('./channel/categoryChannel.js');
const Save = require('../save.js');
const { ChannelType } = require('discord.js');
const channelManager = require('../managers/channelManager.js');
const roleManager = require('../managers/roleManager.js');
const emojiManager = require('../managers/emojiManager.js');

const validAutoArchiveDates = [60, 1440, 10080, 4320];

let client;

class Guild{
    constructor(guild, addon, structureHandler, cache){
        if(cache){
            const addonGuildManager = GuildManager.get(addon.name) || structureHandler.createStructure('Save');
            addonGuildManager.set(guild.id, this);
            GuildManager.set(addon.name, addonGuildManager);
        }
        client = getClient();
        this.addon = addon;
        this.id = guild.id;
        this.name = guild.name;
        const invites = Array.from(guild.invites.cache.values());
        const addonInviteManager = inviteManager.get(addon.name) || new Save();
        const guildInviteManager = addonInviteManager.get(guild.id) || new Save();
        for(var i = 0; i < invites.length; i++){
            if(!validatePermission(getAddonPermission(addon.name), scopes.bitfield.GUILDS)) continue;
            let invite = invites[i];
            if(!guildInviteManager.get(invite.id)) structureHandler.createStructure('Invite', [invite, this, addon]);
        }
        this.iconURL = guild.iconURL({size: 256, dynamic: true});
        this.description = guild.description;
        this.ownerId = guild.ownerId;
        this.verified = guild.verified;
        this.verificationLevel = guild.verificationLevel;
        this.botAdded = new Date(guild.joinedTimestamp);
        this.botAddedTimestamp = guild.joinedTimestamp;
        this.created = new Date(guild.createdTimestamp);
        this.createdTimestamp = guild.createdTimestamp;
        this.everyoneRoleId = guild.roles.everyone.id;
        this.boosts = guild.premiumSubscriptionCount;
        if(validatePermission(getAddonPermission(addon.name), scopes.bitfield.GUILDS)){
            addon.guilds.set(this.id, this);
        }
        this.getMemberCount = function(){
            return guild.memberCount;
        }
        this.setName = function(name){
            return new Promise((resolve, reject) => {
                if(!validatePermission(getAddonPermission(addon.name), scopes.bitfield.GUILDS)) return reject(`Missing guilds scope in bitfield`);
                if(typeof name !== 'string') return reject('The name of the server must be a string');
                guild.setName(name).then(g => {
                    resolve(structureHandler.createStructure('Guild', [g]));
                }).catch(reject);
            });
        }
        this.setIcon = function(iconUrl, reason){
            return new Promise((resolve, reject) => {
                if(!validatePermission(getAddonPermission(addon.name), scopes.bitfield.GUILDS)) return reject(`Missing guilds scope in bitfield`);
                if(typeof iconUrl !== 'string') return reject('The icon url is not a type of string');
                if(typeof reason !== 'string') reason = undefined;
                guild.setIcon(iconUrl, reason).then(g => {
                    resolve(structureHandler.createStructure('Guild', [g]));
                }).catch(reject);
            });
        }
        this.setBanner = function(bannerUrl, reason){
            return new Promise((resolve, reject) => {
                if(!validatePermission(getAddonPermission(addon.name), scopes.bitfield.GUILDS)) return reject(`Missing guilds scope in bitfield`);
                if(typeof bannerUrl !== 'string') return reject('The banner url is not a type of string');
                if(typeof reason !== 'string') reason = undefined;
                guild.setBanner(bannerUrl, reason).then(g => {
                    resolve(structureHandler.createStructure('Guild', [g]));
                }).catch(reject);
            });
        }
        this.unban = function(userId, reason){
            return new Promise((resolve, reject) => {
                if(!validatePermission(getAddonPermission(addon.name), scopes.bitfield.GUILDS) && !validatePermission(getAddonPermission(addon.name), scopes.bitfield.MEMBERS)) return reject(`Missing guilds and members scope in bitfield`);
                if(typeof userId !== 'string') return reject('The id of the user you want to unban is not a type of string');
                if(typeof reason !== 'string') reason = undefined;
                guild.bans.remove(userId, reason).then(g => {
                    resolve(structureHandler.createStructure('Guild', [g]));
                }).catch(reject);
            });
        }
        this.ban = function(member, reason){
            return new Promise((resolve, reject) => {
                if(!validatePermission(getAddonPermission(addon.name), scopes.bitfield.GUILDS) && !validatePermission(getAddonPermission(addon.name), scopes.bitfield.MEMBERS)) return reject(`Missing guilds and members scope in bitfield`);
                if(typeof member !== 'string' && !(member instanceof Member)) return reject('The id of the user you want to unban is not a type of string and not an instance of Member class');
                if(typeof reason !== 'string') reason = undefined;
                guild.bans.create(member instanceof Member ? member.id : member, reason).then(g => {
                    resolve(structureHandler.createStructure('Guild' , [g]));
                }).catch(reject);
            });
        }
        this.createEmoji = function(options){
            return new Promise((resolve, reject) => {
                if(!validatePermission(getAddonPermission(addon.name), scopes.bitfield.EMOJIS)) return reject(`Missing emojis scope in bitfield`);
                if(typeof options !== 'object') return reject('Options argument is not a type of object');
                if(typeof options.imageUrl !== 'string') return reject('The image url of the emoji must be a string');
                if(typeof options.name !== 'string') return reject('The name of the emoji must be a string');
                if(typeof options.reason !== 'string') options.reason = undefined;
                guild.emojis.create({
                    attachment: options.imageUrl,
                    name: options.name,
                    reason: options.reason
                }).then(() => {
                    resolve();
                }).catch(reject);
            });
        }
        this.deleteEmoji = function(emoji, reason){
            return new Promise((resolve, reject) => {
                if(!validatePermission(getAddonPermission(addon.name), scopes.bitfield.EMOJIS)) return reject(`Missing emojis scope in bitfield`);
                if(typeof emoji !== 'string' && !(emoji instanceof Emoji)) return reject('Emoji argument is not instance of Emoji class and not type of string');
                if(typeof reason !== 'string') reason = undefined;
                guild.emojis.delete(emoji instanceof Emoji ? emoji.id : emoji, reason).then(() => {
                    resolve();
                }).catch(reject);
            });
        }
        this.createRole = function(options){
            return new Promise((resolve, reject) => {
                if(!validatePermission(getAddonPermission(addon.name), scopes.bitfield.ROLES)) return reject(`Missing roles scope in bitfield`);
                if(typeof options !== 'object') return reject(`Options argument is not a type of object`);
                if(typeof options.name !== 'string') return reject(`The role's name must be a string`);
                if(typeof options.color !== 'undefined'){
                    if(typeof options.color === 'string'){
                        options.color = getColorCode(options.color);
                    } else if(typeof options.color !== 'number') {
                        return reject(`The role's color must be a type of string or number`);
                    }
                }
                if(typeof options.reason !== 'string') options.reason = undefined;
                if(typeof options.position !== 'number') options.position = undefined;
                if(typeof options.mentionable !== 'boolean') options.mentionable = undefined;
                if(!Array.isArray(options.permissions)) options.permissions = [];
                if(typeof options.host !== 'boolean') options.host = false;
                guild.roles.create({
                    name: options.name,
                    color: options.color,
                    reason: options.reason,
                    position: options.position,
                    permissions: options.permissions,
                    hoist: options.hoist
                }).then(r => {
                    resolve(new Role(r, addon, this));
                }).catch(reject);
            });
        }
        this.deleteRole = function(role, reason){
            return new Promise((resolve, reject) => {
                if(!validatePermission(getAddonPermission(addon.name), scopes.bitfield.ROLES)) return reject(`Missing roles scope in bitfield`);
                if(!(role instanceof Role) && typeof role !== 'string') return reject(`The role argument must be a type of string or instance of the Role class`);
                if(typeof reason !== 'string') reason = undefined;
                guild.roles.delete(role instanceof Role ? role.id : role, reason).then(() => {
                    resolve();
                }).catch(reject);
            });
        }
        this.createChannel = (options) => {
            return new Promise((resolve, reject) => {
                if(!validatePermission(getAddonPermission(addon.name), scopes.bitfield.CHANNELS)) return reject(`Missing roles scope in bitfield`);
                if(typeof options !== 'object') return reject(`The object argument must be a type of string`);
                if(typeof options.name !== 'string') return reject('The name of the channel must be a type of string');
                let slowMode = undefined;
                let autoArchiveThreads = undefined;
                if(typeof options.slowMode === 'number' || typeof options.slowMode === 'string' || options.slowMode instanceof Date){
                    const currentTimestamp = new Date().getTime();
                    slowMode = options.slowMode instanceof Date ? options.slowMode.getTime() - currentTimestamp : getResolvableDate(options.slowMode);
                    slowMode = Math.round(slowMode / 1000);
                }
                if(typeof options.autoArchiveThreads === 'number' || typeof options.autoArchiveThreads === 'string' || options.autoArchiveThreads instanceof Date){
                    const currentTimestamp = new Date().getTime();
                    autoArchiveThreads = options.autoArchiveThreads instanceof Date ? options.autoArchiveThreads.getTime() - currentTimestamp : getResolvableDate(options.autoArchiveThreads);
                    autoArchiveThreads = Math.round(autoArchiveThreads / (60*1000));
                    if(validAutoArchiveDates.indexOf(autoArchiveThreads) < 0){
                        autoArchiveThreads = validAutoArchiveDates[0];
                    }
                }
                guild.channels.create({
                    name: options.name,
                    type: typeof options.type === 'string' ? getChannelId(options.type) : ChannelType.GuildText,
                    parent: options.parent instanceof CategoryChannel || typeof options.parent === 'string' ? (options.parent instanceof CategoryChannel ? options.parent.id : options.parent) : undefined,
                    topic: typeof options.topic === 'string' ? options.topic : undefined,
                    nsfw: typeof options.nsfw === 'boolean' ? options.nsfw : undefined,
                    bitrate: typeof options.bitrate === 'number' ? options.bitrate : undefined,
                    userLimit: typeof options.userLimit === 'number' ? options.userLimit : undefined,
                    position: typeof options.position === 'number' ? options.position : undefined,
                    rateLimitPerUser: slowMode,
                    defaultAutoArchiveDuration: autoArchiveThreads,
                    videoQualityMode: typeof options.videoQuality === 'string' || typeof options.videoQuality === 'number' ? getVideoQualityMode(options.videoQuality) : undefined,
                    rtcRegion: typeof options.rtcRegion === 'string' || options.rtcRegion === null ? (typeof options.rtcRegion === 'string' ? getRegion(options.rtcRegion) : options.rtcRegion) : undefined,
                    reason: typeof options.reason === 'string' ? options.reason : undefined,
                    permissionOverwrites: Array.isArray(options.permissions) ? options.permissions.reduce((arr, i) => {
                        if(typeof i !== 'object' || Array.isArray(i) || i === null) return arr;
                        if(typeof i.id !== 'string') return arr;
                        if(!Array.isArray(i['allow']) && !Array.isArray(i['deny'])) return arr;
                       	if(typeof i['type'] === 'string'){
                            switch(i['type'].toLowerCase()){
                                case 'user':
                                    i['type'] = 1;
                                    break;
                                case 'member':
                                    i['type'] = 1;
                                    break;
                                case 'role':
                                    i['type'] = 0;
                                    break;
                                default:
                                    delete i['type'];
                                    break;
                            }
                        }
                        arr.push(i);
                        return arr;
                    }, []) : undefined
                }).then(ch => {
                    if(ch.type === ChannelType.GuildText || ch.type === ChannelType.GuildAnnouncement){
                        resolve(structureHandler.createStructure('TextChannel', [ch, addon, this]));
                    } else if(ch.type === ChannelType.GuildCategory){
                        resolve(structureHandler.createStructure('CategoryChannel', [ch, addon, this]));
                    } else if(ch.type === ChannelType.GuildVoice){
                        resolve(structureHandler.createStructure('VoiceChannel', [ch, addon, this]));
                    } else if(ch.type === ChannelType.GuildStageVoice){
                        resolve(structureHandler.createStructure('StageChannel', [ch, addon, this]));
                    } else if(ch.type === ChannelType.GuildForum){
                        resolve(structureHandler.createStructure('ForumChannel', [ch, addon, this]));
                    } else if(ch.type === ChannelType.GuildDirectory){
                        resolve(structureHandler.createStructure('DirectoryChannel', [ch, addon, this]));
                    } else {
                        resolve(undefined);
                    }
                }).catch(reject);
            });
        }
    }
    get members(){
        const addonGuildMemberManager = GuildMemberManager.get(this.addon.name) || new Save();
        const guildMembers = addonGuildMemberManager.get(this.id) || new Save();
        return guildMembers;
    }
    get moderationRoles(){
        return this.roles.filter(r => (client.config.moderator_roles[this.id] || []).indexOf(r.value.id) >= 0);
    }
    get ticketRoles(){
        return this.roles.filter(r => (client.config.tickets.roles[this.id] || []).indexOf(r.value.id) >= 0);
    }
    get joinRoles(){
        return this.roles.filter(r => (client.config.joinRoles[this.id] || []).indexOf(r.value.id) >= 0);
    }
    get owner(){
        const addonGuildMemberManager = GuildMemberManager.get(this.addon.name) || new Save();
        const guildMembers = addonGuildMemberManager.get(this.id) || new Save();
        return guildMembers.get(this.ownerId);
    }
    get invites(){
        const addonInviteManager = inviteManager.get(this.addon.name) || new Save();
        const guildInviteManager = addonInviteManager.get(this.id) || new Save();
        return guildInviteManager;
    }
    get channels(){
        const addonChannelManager = channelManager.get(this.addon.name) || new Save();
        const guildChannelManager = addonChannelManager.get(this.id) || new Save();
        return guildChannelManager;
    }
    get emojis(){
        const addonEmojiManager = emojiManager.get(this.addon.name) || new Save();
        const guildEmojiManager = addonEmojiManager.get(this.id) || new Save();
        return guildEmojiManager;
    }
    get roles(){
        const addonRoleManager = roleManager.get(this.addon.name) || new Save();
        const guildRoleManager = addonRoleManager.get(this.id) || new Save();
        return guildRoleManager;
    }
    get everyoneRole(){
        return this.roles.filter(role => role.value.id === this.everyoneRoleId).first();
    }
    get voiceStates(){
        const addonVoiceStateManager = VoiceStateManager.get(this.addon.name) || new Save();
        const guildVoiceStateManager = addonVoiceStateManager.get(this.id) || new Save();
        return guildVoiceStateManager;
    }
    get memberCount(){
        return this.getMemberCount();
    }
}

module.exports = Guild;
