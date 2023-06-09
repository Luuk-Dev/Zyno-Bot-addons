const EventEmitter = require('events');
const Save = require('./save.js');
const { createBitfield, validatePermission, getAddonPermission } = require('../utils/functions.js');
const { commandListeners, eventListeners, addons, addonCreate, botClasses } = require('../utils/saves.js');
const { registerAddon, commandRegistrant } = require('./handlers/addonHandler.js');
const Bot = require('./structures/bot.js');
const CommandBuilder = require('./builders/commandBuilder.js');
const scopes = require('../bitfields/scopes.js');
const { getClientParser } = require('../utils/parser.js');
const HttpServerHandler = require('./server/handler.js');

const clientParser = getClientParser();

class Addon extends EventEmitter{
    constructor(options = {}){
        super();
        (async () => {
            Object.defineProperty(this, 'ready', {
                value: false,
                writable: false
            });
            if(typeof options !== 'object' || Array.isArray(options) || !options) throw new Error(`Addon is invalid, please follow the documentation to create an addon`);
            var keys = Object.keys(options);
            if(keys.indexOf('name') < 0) throw new Error(`No name was provided`);
            if(typeof options.description !== 'string') throw new Error(`A description is required for the addon and must be a string`);
            if(options.description.length === 0 || options.description.length > 100) throw new Error(`Description must be between 1-100 characters long`);
            if(!Array.isArray(options.bitfield) && typeof options.bitfield !== 'number') throw new Error(`A bitfield with the required permissions for the addon is required and must be an array or number`);
            if(typeof options.version !== 'string') throw new Error(`A version is required for the addon and must be a string`);
            if(options.version.length === 0 || options.version.length > 10) throw new Error(`Version must be between 1-10 characters long`);
            if(typeof options.author !== 'string') throw new Error(`An author is required for the addon and must be a string`);
            if(options.author.length === 0 || options.author.length > 50) throw new Error(`Author must be between 1-50 characters long`);

            if(typeof options.name !== 'string') throw new Error(`The addon name must be a string`);
            if(options.name.length === 0 || options.name.length > 50) throw new Error(`Name must be between 1-50 characters long`);
            Object.defineProperty(this, 'name', {
                value: options.name,
                writable: false
            });

            Object.defineProperties(this, {
                description: {
                    value: options.description,
                    writable: false
                },
                version: {
                    value: options.version,
                    writable: false
                },
                author: {
                    value: options.author,
                    writable: false
                }
            });
            if(Array.isArray(options.bitfield)){
                if(!!options.bitfield.filter(v => typeof v !== 'number').length) throw new Error(`The bitfield is incorrect, make sure to use the correct bitfield values`);
                Object.defineProperty(this, 'permissions', {
                    value: createBitfield(options.bitfield),
                    writable: false
                });
            } else if(typeof options.bitfield === 'number'){
                Object.defineProperty(this, 'permissions', {
                    value: options.bitfield,
                    writable: false
                });
            } else {
                throw new Error(`The bitfield must be an Array of scopes or a number`);
            }

            const registrant = await registerAddon(this);
            
            if(registrant === true){
                Object.defineProperty(this, 'ready', {
                    value: true,
                    writable: false
                });
                if(clientParser.ready === false){
                    clientParser.once('ready', () => {
                        this.emit('ready');
                    });
                } else {
                    this.emit('ready');
                }
            } else if(registrant !== false) {
                console.log(`Error while registering addon '${this.name}':`, registrant.error);
                return;
            }
        })().catch(err => {
            throw new Error(err);
        });
    }
    createCommand(command){
        return new Promise((resolve, reject) => {
            if(!validatePermission(getAddonPermission(this.name), scopes.bitfield.COMMANDS)) return reject(`The addon doesn't have the permissions to create a command`);
            if(!(command instanceof CommandBuilder)) return reject(`Invalid command: Command is not instance of CommandBuilder class`);
            var commandJSON = command.toJSON();
            if(typeof commandJSON.name !== 'string') return reject('Invalid command: Command name must be a string');
            if(typeof commandJSON.description !== 'string') return reject('Invalid command: Command description must be a string');
            commandRegistrant.register(commandJSON, this.name).then(resolve).catch(reject);
        });
    }
    createEventListener(){
        const filterEventListener = eventListeners.filter(e => e.addonName === this.name);
        if(filterEventListener.length > 0){
            return filterEventListener[0].listener;
        } else {
            const event = new EventEmitter();
            eventListeners.push({listener: event, addonName: this.name});
            return event;
        }
    }
    createCommandListener(){
        const filterCommandListener = commandListeners.filter(e => e.addonName === this.name);
        if(filterCommandListener.length > 0){
            return filterCommandListener[0].listener;
        } else {
            const event = new EventEmitter();
            commandListeners.push({listener: event, addonName: this.name});
            return event;
        }
    }
    getBot(){
        return new Promise((resolve, reject) => {
            let addonInfo = addons.get(this.name);
            new Promise((resolve, _reject) => {
                if(addonInfo) resolve();
                else {
                    addonCreate.once(this.name, (allowed) => {
                        if(allowed === true){
                            addonInfo = addons.get(this.name);
                            resolve();
                        } else {
                            _reject('The addon has been declined by the bot\'s owner');
                        }
                    });
                }
            }).then(() => {
                if(addonInfo.verified === false || addonInfo.allowed === false) return reject('Addon hasn\'t been enabled by the owner of the bot');
                new Promise((parse) => {
                    if(clientParser.ready === false){
                        clientParser.once('ready', () => {
                            parse()
                        })
                    } else {
                        parse();
                    }
                }).then(() => {
                    const filter = botClasses.filter(b => b.addonName === this.name);
                    if(filter.length > 0){
                        resolve(filter[0].bot);
                    } else {
                        const bot = new Bot(this);
                        botClasses.push({addonName: this.name, bot: bot});
                        resolve(bot);
                    }
                });
            }).catch(reject)
        });
    }
    getHTTPServer(){
        return new Promise((resolve, reject) => {
            let addonInfo = addons.get(this.name);
            new Promise((resolve, _reject) => {
                if(addonInfo) resolve();
                else {
                    addonCreate.once(this.name, (allowed) => {
                        if(allowed === true){
                            addonInfo = addons.get(this.name);
                            resolve();
                        } else {
                            _reject('The addon has been declined by the bot\'s owner');
                        }
                    });
                }
            }).then(() => {
                if(addonInfo.verified === false || addonInfo.allowed === false) return reject('Addon hasn\'t been enabled by the owner of the bot');
                if(!validatePermission(getAddonPermission(this.name), scopes.bitfield.SERVERS)) return reject('The addon doesn\'t have permissions to make use of the HTTP server');
                new Promise((parse) => {
                    if(clientParser.ready === false){
                        clientParser.once('ready', () => {
                            parse(clientParser.getClient());
                        })
                    } else {
                        parse(clientParser.getClient());
                    }
                }).then(client => {
                    const port = client.config.port;
                    if(typeof port === 'string' || typeof port === 'number'){
                        resolve(HttpServerHandler.startHTTPServer(parseInt(port)));
                    } else {
                        return reject('The owner of the bot hasn\'t set a port for the HTTP server');
                    }
                });
            }).catch(reject);
        });
    }
    getWSServer(){
        return new Promise((resolve, reject) => {
            let addonInfo = addons.get(this.name);
            new Promise((resolve, reject) => {
                if(addonInfo) resolve();
                else {
                    addonCreate.once(this.name, (allowed) => {
                        if(allowed === true){
                            addonInfo = addons.get(this.name);
                            resolve();
                        } else {
                            reject('The addon has been declined by the bot\'s owner');
                        }
                    });
                }
            }).then(() => {
                if(addonInfo.verified === false || addonInfo.allowed === false) return reject('Addon hasn\'t been enabled by the owner of the bot');
                if(!validatePermission(getAddonPermission(this.name), scopes.bitfield.SERVERS)) return reject('The addon doesn\'t have permissions to make use of the WebSocket server');
                new Promise((parse) => {
                    if(clientParser.ready === false){
                        clientParser.once('ready', () => {
                            parse(clientParser.getClient());
                        })
                    } else {
                        parse(clientParser.getClient());
                    }
                }).then(client => {
                    const port = client.config.port;
                    if(typeof port === 'string' || typeof port === 'number'){
                        resolve(HttpServerHandler.startWSServer(parseInt(port)));
                    } else {
                        return reject('The owner of the bot hasn\'t set a port for the HTTP server');
                    }
                });
            }).catch(reject);
        });
    }
    getRawSaves(){
        return new Promise((resolve, reject) => {
            let addonInfo = addons.get(this.name);
            new Promise((resolve, reject) => {
                if(addonInfo) resolve();
                else {
                    addonCreate.once(this.name, (allowed) => {
                        if(allowed === true){
                            addonInfo = addons.get(this.name);
                            resolve();
                        } else {
                            reject('The addon has been declined by the bot\'s owner');
                        }
                    });
                }
            }).then(() => {
                if(addonInfo.verified === false || addonInfo.allowed === false) return reject('Addon hasn\'t been enabled by the owner of the bot');
                if(!validatePermission(getAddonPermission(this.name), scopes.bitfield.SAVES)) return reject('The addon doesn\'t have permissions to read the saves');
                new Promise((parse) => {
                    if(clientParser.ready === false){
                        clientParser.once('ready', () => {
                            parse(clientParser.getClient());
                        })
                    } else {
                        parse(clientParser.getClient());
                    }
                }).then(client => {
                    resolve({
                        tickets: new Save(client.tickets),
                        level: new Save(client.xp),
                        economy: new Save(client.economy),
                        afk: new Save(client.afk),
                        badwords: new Save(client.badwords),
                        giveaways: new Save(client.giveaways),
                        reactrole: new Save(client.reactrole),
                        suggestions: new Save(client.suggestions),
                        warns: new Save(client.warns)
                    });
                });
            }).catch(reject);
        })
    }
    name = null;
    description = null;
    version = null;
    author = null;
    permissions = 0;
    ready = false;
    guilds = new Save();
    channels = new Save();
    commands = new Save();
}

module.exports = Addon;
