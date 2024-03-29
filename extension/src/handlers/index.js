import config from '../config';

export function registerHandlers (hub) {
    require('./sync').register(hub);
    require('./logger').register(hub);

    if (config.DEVELOPMENT) {
        require('./reloadExtension').register(hub);
    }
}
