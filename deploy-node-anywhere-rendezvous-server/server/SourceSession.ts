import {remote, ServerSession, ServerSessionOptions} from "restfuncs-server";
import {tags} from "typia";
import {application, NewDeploymentMessage} from "./Application.js"

/**
 * Called by the source (the deploy-node-app command on the development machine)
 */
export class SourceSession extends ServerSession {

    static options: ServerSessionOptions = {/* Configuration */}
    alreadyOfferingTypingFriendlyKeyTranslation = false;

    /**
     *
     * @param typingFriendlyTargetKey
     * @param sourceListener called when the target has sent the translation request (=on the first run with unsing the typing friendly key). Must then be answered by the source with the real key = returning it as the result.
     */
    @remote offerTypingFriendlyKeyTranslation(typingFriendlyTargetKey: string & tags.MaxLength<10>, sourceListener: () => Promise<string>) {
        // Security:
        if(this.alreadyOfferingTypingFriendlyKeyTranslation) {
            throw new Error("Already called for this session"); // Security: Make brute force installation of million listeners harder  - only one per session
        }

        // Handle already listening targets:
        application.targetsListeningOnTypingFriendlyKeyTranslation.getCallbacksFor(typingFriendlyTargetKey).forEach(targetListener => {
            sourceListener().then(targetHexKey => targetListener(targetHexKey)); // call source listener and send its result to the targetListener
        });

        application.sourcesOfferingTypingFriendlyKeyTranslations.set(typingFriendlyTargetKey, sourceListener); // Listen for targets that want it in the future


        this.alreadyOfferingTypingFriendlyKeyTranslation = true;
    }

    @remote offerNewDeployment(rendezvousKey: string & tags.MaxLength<64>, sourceListener: () => Promise<NewDeploymentMessage>) {
        // Handle already listening targets:
        application.targetsListeningForNewDeployment.getCallbacksFor(rendezvousKey).forEach(targetListener => {
            sourceListener().then(newDeploymentMessage => targetListener(newDeploymentMessage)); // call source listener and send its result to the targetListener
        })

        application.sourcesOfferingNewDeployment.set(rendezvousKey, sourceListener);
    }
}