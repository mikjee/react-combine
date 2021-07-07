
// event = name of the event
// target = the layer which caused the event
// source = the layer where the handler was attached (in case of mirrors/inherited)
// e = eventdetails

var methodHandlers = {}
var eventHandlers = {}
// var reducers = {}

export const registerEventHandler = (layerId, event, fn) => {
	if (!eventHandlers[layerId]) eventHandlers[layerId] = {}
	if (!eventHandlers[layerId][event]) eventHandlers[layerId][event] = new Map()
	eventHandlers[layerId][event].set(fn, true)
}

export const unregisterEventHandler = (layerId, event, fn) => {
	if (!eventHandlers[layerId]) return
	else if (!eventHandlers[layerId][event]) return
	else if (!eventHandlers[layerId][event].has(fn)) return
	
	eventHandlers[layerId][event].delete(fn)
	if (!Object.keys(eventHandlers[layerId][event]).size) delete eventHandlers[layerId][event]
	if (!Object.keys(eventHandlers[layerId]).length) delete eventHandlers[layerId]
}

export const handleEvent = (globalState, event, targetLayer, e) => {
	let sourceLayer = targetLayer

	while (true) {

		if (eventHandlers[sourceLayer]) {
			if (eventHandlers[sourceLayer][event]) {
				eventHandlers[sourceLayer][event].forEach((_, fn) => {
					fn(e, event, targetLayer, sourceLayer)
				})
			}
		}

		if (globalState.layers[sourceLayer].type === 'mirror' || 
			globalState.layers[sourceLayer].type === 'inherit' ||
			globalState.layers[sourceLayer].type === 'user'
		) sourceLayer = globalState.layers[sourceLayer].source

		else break
		
	}
}

export const registerMethodHandler = (layerId, method, fn) => {
	if (!methodHandlers[layerId]) methodHandlers[layerId] = {}
	methodHandlers[layerId][method] = fn
}

export const unregisterMethodHandler = (layerId, method) => {
	if (!methodHandlers[layerId]) return
	else if (!methodHandlers[layerId][method]) return
	
	delete methodHandlers[layerId][method]
	if (!Object.keys(methodHandlers[layerId]).length) delete methodHandlers[layerId]
}

export const callMethod = (layerId, method, ...args) => {
	if (!methodHandlers[layerId]) throw `No methods exist for layer '${layerId}' or layer does not exist!`
	else if (!methodHandlers[layerId][method]) throw `Method '${method}' does not exist for layer '${layerId}'!`
	else return methodHandlers[layerId][method](...args)
}

// export const executeUserReducer = (globalState, action) => {

// }

// export const registerUserReducer = (stateSliceKey, reducerFn) => {
// 	reducers[stateSliceKey] = reducerFn
// }