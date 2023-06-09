const GuildManager = require('../../managers/guildManager.js');
const GuildMemberManager = require('../../managers/guildMemberManager.js');
const Message = require('../message.js');
const User = require('../user.js');
const { getMessageContent } = require('../../../utils/messageFunctions.js');
const Save = require('../../save.js');

class ButtonInteraction{
    constructor(data, addon){
        const addonGuildManager = GuildManager.get(addon.name) || new Save();
        this.guild = addonGuildManager.get(data.guildId);
        this.guildId = data.guildId;
        this.channel = this.guild ? this.guild.channels.get(data.channelId) : null;
        this.channelId = data.channelId;
        const addonGuildMemberManager = GuildMemberManager.get(addon.name) || new Save();
        const GuildMembers = addonGuildMemberManager.get(this.guildId) || new Save();
        this.member = GuildMembers.get(data.member.id);
        this.user = new User(data.user, addon, false);
        this.message = new Message(data.message, addon);
        this.customId = data.customId;
        this.id = data.id;
        this.deferUpdate = function(){
            return new Promise((resolve, reject) => {
                data.deferUpdate().then(() => resolve()).catch(reject)
            });
        };
        this.deferReply = function(){
            return new Promise((resolve, reject) => {
                data.deferReply().then(() => resolve()).catch(reject)
            });
        }
        this.deleteReply = function(){
            return new Promise((resolve, reject) => {
                data.deleteReply().then(() => resolve()).catch(reject)
            });
        };
        this.reply = function(...content){
            return new Promise((resolve, reject) => {
                if(content.length === 0) return reject(`At least one argument must be given`);
                let _content = getMessageContent(content);
                if(!data.replied && !data.deferred) data.reply({..._content, fetchReply: true}).then(msg => resolve(new Message(msg, addon))).catch(reject);
                else data.editReply({..._content, fetchReply: true}).then(msg => resolve(new Message(msg, addon))).catch(reject);
            });
        };
        this.followUp = function(...content){
            return new Promise((resolve, reject) => {
                if(content.length === 0) return reject(`At least one argument must be given`);
                let _content = getMessageContent(content);
                data.followUp({..._content, fetchReply: true}).then(msg => resolve(new Message(msg, addon))).catch(reject);
            });
        };
        this.update = function(...content){
            return new Promise((resolve, reject) => {
                if(content.length === 0) return reject(`At least one argument must be given`);
                let _content = getMessageContent(content);
                data.update({..._content, fetchReply: true}).then(msg => resolve(new Message(msg, addon))).catch(reject);
            });
        };
    }
}

module.exports = ButtonInteraction;
