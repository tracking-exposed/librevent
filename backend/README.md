##  Requirement

mongodb should run locally;
node 16+
npm install
npm run watch

check ./settings.json if you want to customize mongodb or IPv4 address/port.

### This code was inhering a lot of copy from

* [facebook.tracking.exposed](https://facebook.tracking.exposed), but it wasn't a problem of license/copyright because both of them are AGPL-3.0 from the same author. The model since librevent 0.3 changed, shifting for a client side parsing and bridging between the backend and mobiizon.
* It follows the [tracking.exposed manifesto](https://trackinge.exposed/manifesto); The goal is here is to help people in moving to the federated architecture.


## F.A.Q: why we even need the backend?

Yes, it is possible in a future that extension should directly communicate with a mobilizon instance, but:

* Currently there is no OAUTH support in mobilizon (except for Facebook, which i never tried to implement)
* Event without no OAUTH, we can integrate [mobilzion-poster](https://github.com/vecna/mobilizon-poster)
* Managing connection to mobilizon/backend from the extension might be complex for the limitation of the extensions
* A backend might allow to handle the events duplication, because each facebook event has the same eventId, it might also suggest to users which are the events that might need to be "re-liberated" because nobody knows how and if we want to manage the event update.
* A theory is to move the backend into every mobilizone docker, so the auth credentials are travelling to the same server and only there.
