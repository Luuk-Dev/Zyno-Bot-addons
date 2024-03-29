const { validatePermission, getResolvableDate, getAddonPermission, wait, getClient } = require('../../utils/functions.js');
const scopes = require('../../bitfields/scopes.js');
const User = require('./user.js');
const MemberManager = require('../managers/memberManager.js');
const GuildMemberManager = require('../managers/guildMemberManager.js');
const GuildManager = require('../managers/guildManager.js');
const Save = require('../save.js');
const Role = require('./role.js');
const EconomyBalance = require('./saves/economyBalance.js');
const Level = require('./saves/level.js');
const roleManager = require('../managers/roleManager.js');
const voiceStateManager = require('../managers/voiceStateManager.js');

let client;

class Member extends User{
	constructor(guildMember, addon, structureHandler, cache){
        client = getClient();
        super((guildMember.user ?? client.users.cache.get(guildMember.id)), addon, false, structureHandler, cache);
        this.addon = addon;
        if(cache){
            const addonMemberManager = MemberManager.get(addon.name) || new Save();
            const memberManager = addonMemberManager.get(guildMember.id) || new Save();
            memberManager.set(guildMember.guild.id, this);
            addonMemberManager.set(guildMember.id, memberManager);
            MemberManager.set(addon.name, addonMemberManager);
            const addonGuildMemberManager = GuildMemberManager.get(addon.name) || new Save();
            const guildMemberManager = addonGuildMemberManager.get(guildMember.guild.id) || new Save();
            guildMemberManager.set(guildMember.id, this);
            addonGuildMemberManager.set(guildMember.guild.id, guildMemberManager);
            GuildMemberManager.set(addon.name, addonGuildMemberManager);
        }
        this.guildId = guildMember.guild?.id;
        const guildRoles = Array.from(guildMember.roles.cache.keys());
        this._roles = guildRoles;
        this.nickname = guildMember.nickname;
        this.displayName = guildMember.displayName;
	this.permissions = guildMember.permissions;
        this.color = {
            hex: guildMember.displayHexColor,
            base: guildMember.displayColor
        };
        this.joinedTimestamp = guildMember.joinedTimestamp;
        this.joined = new Date(this.joinedTimestamp);
        this.manageable = guildMember.manageable;
        this.moderatable = guildMember.moderatable;
        this.bannable = guildMember.bannable;
        this.kickable = guildMember.kickable;
        this.voiceConnected = typeof guildMember.voice.channelId === 'string';
        this.getInviteInfo = () => {
            if(!validatePermission(getAddonPermission(addon.name), scopes.bitfield.MEMBERS)) throw new Error(`Missing members scope in bitfield`);
            const userinfo = client.userinfo.get(guildMember.id) || [];
            const guildUserInfo = userinfo.filter(i => i.guild === this.guildId) || {invitedBy: undefined, invites: 0, inviteleaves: 0};
            const addonGuildMemberManager = GuildMemberManager.get(addon.name) || new Save();
            const guildMembers = addonGuildMemberManager.get(guildMember.guild.id) || new Save();
            return {
                invitedBy: typeof guildUserInfo.invitedBy === 'string' ? guildMembers.get(guildUserInfo.invitedBy) : undefined,
                invites: guildUserInfo.invites ?? 0,
                leaves: guildUserInfo.inviteleaves ?? 0,
                total: (guildUserInfo.invites ?? 0) - (guildUserInfo.inviteleaves ?? 0)
            };
        };
        this.getWarns = () => {
            if(!validatePermission(getAddonPermission(addon.name), scopes.bitfield.MEMBERS)) throw new Error(`Missing members scope in bitfield`);
            const addonGuildMemberManager = GuildMemberManager.get(addon.name) || new Save();
            const guildMembers = addonGuildMemberManager.get(guildMember.guild.id) || new Save();
            let userWarns = (client.warns.get(guildMember.id) || []);
            userWarns = userWarns.filter(w => w.guild === guildMember.guild.id).map(w => {
                return {
                    warnedBy: typeof w.warnedBy === 'string' ? (guildMembers.get(w.warnedBy) || undefined) : undefined,
                    reason: w.reason,
                    warnedAt: new Date(w.warnedAt),
                    warnedAtTimestamp: w.warnedAt
                };
            });
            return userWarns;
        };
        this.getTickets = function(){
            if(!validatePermission(getAddonPermission(addon.name), scopes.bitfield.MEMBERS)) throw new Error(`Missing members scope in bitfield`);
            const ticketsSave = new Save();
            const memberTickets = client.tickets.get(guildMember.id);
            if(typeof memberTickets === 'string'){
                const guildTicket = this.guild.channels.get(memberTickets);
                if(guildTicket) ticketsSave.set(memberTickets, guildTicket);
            } else if(Array.isArray(memberTickets)){
                for(var i = 0; i < memberTickets.length; i++){
                    var openTicket = memberTickets[i];
                    if(typeof openTicket === 'string'){
                        var guildTicket = this.guild.channels.get(openTicket);
                        if(guildTicket) ticketsSave.set(openTicket, guildTicket);
                    } else if(typeof openTicket === 'object' && !Array.isArray(openTicket) && openTicket !== null){
                        if(openTicket.guild === this.guild.id){
                            var guildTicket = this.guild.channels.get(openTicket.channel);
                            if(guildTicket) ticketsSave.set(openTicket.channel, guildTicket);
                        }
                    }
                }
            }
            return ticketsSave;
        }
        this.getEconomy = function(){
            if(!validatePermission(getAddonPermission(addon.name), scopes.bitfield.SAVES)) throw new Error(`Missing saves scope in bitfield`);
            return new EconomyBalance(client, guildMember);
        }
        this.getLevel = function(){
            if(!validatePermission(getAddonPermission(addon.name), scopes.bitfield.SAVES)) throw new Error(`Missing saves scope in bitfield`);
            return new Level(client, guildMember);
        }
        this.setTimeout = function(dateResolvable, reason){
            return new Promise((resolve, reject) => {
                if(!validatePermission(getAddonPermission(addon.name), scopes.bitfield.MEMBERS)) return reject(`Missing members scope in bitfield`);
                if(typeof dateResolvable !== 'string' && typeof dateResolvable !== 'number' && !(dateResolvable instanceof Date)) return reject(`Date is not resolvable, must be a string or a number`);
                if(typeof reason !== 'string') reason = undefined;
                var resolveDate = dateResolvable instanceof Date ? dateResolvable.getTime() : getResolvableDate(dateResolvable) + new Date().getTime();
                guildMember.disableCommunicationUntil(resolveDate, reason).then(member => {
                    resolve(new Member(member, addon));
                }).catch(reject);
            });
        }
        this.removeTimeout = function(reason){
            return new Promise((resolve, reject) => {
                if(!validatePermission(getAddonPermission(addon.name), scopes.bitfield.MEMBERS)) return reject(`Missing members scope in bitfield`);
                if(typeof reason !== 'string') reason = undefined;
                guildMember.disableCommunicationUntil(null, reason).then(member => {
                    resolve(new Member(member, addon));
                }).catch(reject);
            });
        }
        this.hasTimeout = function(){
            return guildMember.isCommunicationDisabled();
        }
        this.timeoutUntil = function(){
            return guildMember.communicationDisabledUntilTimestamp;
        }
        this.kick = function(reason){
            return new Promise((resolve, reject) => {
                if(!validatePermission(getAddonPermission(addon.name), scopes.bitfield.MEMBERS)) return reject(`Missing members scope in bitfield`);
                if(typeof reason !== 'string') reason = undefined;
                guildMember.kick(reason).then(member => {
                    resolve(new Member(member, addon));
                }).catch(reject);
            });
        }
        this.ban = function(options){
            return new Promise((resolve, reject) => {
                if(!validatePermission(getAddonPermission(addon.name), scopes.bitfield.MEMBERS)) return reject(`Missing members scope in bitfield`);
                if(typeof options === 'string') options = {reason: options, deleteMessagesTime: 0};
                else if(typeof options !== 'object' || Array.isArray(options) || options === null) options = {};
                var maxDate = 7*24*60*60;
                var deleteMessages = Math.round(getResolvableDate(options.deleteMessagesTime || '0ms') / 1000);
                guildMember.ban({
                    reason: typeof options.reason === 'string' ? options.reason : undefined,
                    deleteMessageSeconds: deleteMessages > maxDate ? maxDate : (deleteMessages < 0 ? 0 : deleteMessages)
                }).then(member => {
                    resolve(new Member(member, addon));
                }).catch(reject);
            });
        }
        this.update = function(){
            return new Promise(async (resolve, reject) => {
                try{
                    await guildMember.user.fetch();
                    await wait(200);
                } catch (err){
                    return reject(err);
                }
                guildMember.fetch().then(g => {
                    resolve(new Member(g, addon));
                }).catch(reject);
            });
        }
        this.addRole = function(role, reason){
            return new Promise((resolve, reject) => {
                if(!validatePermission(getAddonPermission(addon.name), scopes.bitfield.MEMBERS)) return reject(`Missing members scope in bitfield`);
                if(!Array.isArray(role) && typeof role !== 'string' && !(role instanceof Role)) return reject('Role argument is not a resolvable role or array of resolvable roles');
                if(typeof reason !== 'string') reason = undefined;
                
                if(Array.isArray(role)){
                    role = role.map(r => typeof r === 'string' ? r : r.id);
                } else if(role instanceof Role){
                    role = [role.id];
                } else if(typeof role === 'string'){
                    role = [role];
                }
                
                guildMember.roles.add(role, reason).then(m => {
                    resolve(new Member(m, addon));
                }).catch(reject);
            });
        }
        this.removeRole = function(role, reason){
            return new Promise((resolve, reject) => {
            	if(!validatePermission(getAddonPermission(addon.name), scopes.bitfield.MEMBERS)) return reject(`Missing members scope in bitfield`);
                if(!Array.isArray(role) && typeof role !== 'string' && !(role instanceof Role)) return reject('Role argument is not a resolvable role or array of resolvable roles');
                if(typeof reason !== 'string') reason = undefined;
                
                if(Array.isArray(role)){
                    role = role.map(r => typeof r === 'string' ? r : r.id);
                } else if(role instanceof Role){
                    role = [role.id];
                } else if(typeof role === 'string'){
                    role = [role];
                }
                
                guildMember.roles.remove(role, reason).then(m => {
                    resolve(new Member(m, addon));
                }).catch(reject);
            });
        }
    	this.setRole = function(role, reason){
            return new Promise((resolve, reject) => {
            	if(!validatePermission(getAddonPermission(addon.name), scopes.bitfield.MEMBERS)) return reject(`Missing members scope in bitfield`);
                if(!Array.isArray(role) && typeof role !== 'string' && !(role instanceof Role)) return reject('Role argument is not a resolvable role or array of resolvable roles');
                if(typeof reason !== 'string') reason = undefined;
                
                if(Array.isArray(role)){
                    role = role.map(r => typeof r === 'string' ? r : r.id);
                } else if(role instanceof Role){
                    role = [role.id];
                } else if(typeof role === 'string'){
                    role = [role];
                }
                    
                guildMember.roles.set(role, reason).then(m => {
                    resolve(new Member(m, addon));
                }).catch(reject);
            });
        }
    }
    isBannable(){
        return this.bannable;
    }
    isKickable(){
        return this.kickable;
    }
    isMutable(){
        return this.moderateable;
    }
    get guild(){
        const addonGuildManager = GuildManager.get(this.addon.name) || new Save();
        return addonGuildManager.get(this.guildId);
    }
    get roles(){
        const addonRoleManager = roleManager.get(this.addon.name) || new Save();
        const guildRoleManager = addonRoleManager.get(this.guildId) || new Save();
        const roles = new Save();
        for(let i = 0; i < this._roles.length; i++){
            var role = guildRoleManager.get(this._roles[i]);
            if(role) roles.set(this._roles[i], role);
            else continue;
        }
        return roles;
    }
    get voiceState(){
        const addonVoiceStateManager = voiceStateManager.get(this.addon.name) || new Save();
        const guildVoiceStateManager = addonVoiceStateManager.get(this.guildId) || new Save();
        return guildVoiceStateManager.get(this.id);
    }
}

module.exports = Member;
