import {remote, ServerSession, ServerSessionOptions} from "restfuncs-server";
import {tags} from "typia";
import {Application, application, NewDeploymentMessage} from "./Application.js"

/**
 * Called by the target / the autopuller
 */
export class TargetSession extends ServerSession {

    static options: ServerSessionOptions = {/* Configuration */}

    /**
     *
     * @param typeingFriendlyKey
     * @returns the target hex key or undefined when it is denied for security reasons
     */
    @remote typingFriendlyKeyToTargetHexKey(typeingFriendlyKey: string & tags.MaxLength<10>): Promise<string|undefined> {
        let alreadyListeningSource = application.sourcesOfferingTypingFriendlyKeyTranslations.get(typeingFriendlyKey);
        if(alreadyListeningSource) { // Source is already listening ?
            return alreadyListeningSource(); // Call the sources callback which returns itseelf a result
        }
        else {
            return new Promise<string | undefined>((resolve, reject) => {
                (async () => {
                    const listener = (result: string | undefined) => {
                        application.targetsListeningOnTypingFriendlyKeyTranslation.remove(typeingFriendlyKey, listener);
                        resolve(result);
                    }
                    listener.socketConnection = this.call.socketConnection; //  Associate to socketConnection, so it can be used with the following line and things get cleaned up on disconnect
                    application.targetsListeningOnTypingFriendlyKeyTranslation.add(typeingFriendlyKey, listener);
                })();
            });
        }
    }

    @remote listenForNewDeployments(rendezvousKey: string & tags.MaxLength<64>, targetListener: (newDeploymentMessage: NewDeploymentMessage) => void) {
        // Handle already offering source:
        let alreadyOfferingSourceListener = application.sourcesOfferingNewDeployment.get(rendezvousKey);
        if(alreadyOfferingSourceListener) {
            alreadyOfferingSourceListener().then(newDeploymentMessage => targetListener(newDeploymentMessage)); // call source listener and send its result to the targetListener
        }

        application.targetsListeningForNewDeployment.add(rendezvousKey, targetListener); // Add listener for sources that connect in the future.

    }
}