import { listen, UnlistenFn } from "@tauri-apps/api/event";

export class EventListener {
    unlistenMap: Map<string, UnlistenFn> = new Map();

    add(event: string, callback: (payload: string) => void) {
        listen(event, (e) => callback(e.payload as string))
            .then((unlisten) => this.unlistenMap.set(event, unlisten));
    }

    remove(event: string) {
        var unlisten = this.unlistenMap.get(event);
        if (unlisten) unlisten();
        this.unlistenMap.delete(event);
    }
}
