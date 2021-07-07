export default storeEnhancers => createStore => (rootReducer, initialState) => {

	const store = createStore(rootReducer, initialState, storeEnhancers)

	let listeners = {}
	let listenerCounter = 0
	let isDispatching = false

	const customSubscribe = listener => {
		let listenerId = listenerCounter
		listenerCounter ++
		listeners[listenerId] = listener

		return () => delete listeners[listenerId]
	}	
	
	const notifyListeners = () => {
		if (isDispatching) return
		Object.keys(listeners).forEach(listenerId => listeners[listenerId]())
	}

	const customDispatch = action => {
		let isTopLevelDispatcher = !isDispatching
		isDispatching = true

		if (Array.isArray(action)) action.forEach(a => originalDispatch(a))
		else originalDispatch(action)

		if (isTopLevelDispatcher) isDispatching = false
		if (!isDispatching) notifyListeners()
	}

	const originalSubscribe = store.subscribe
	store.subscribe = customSubscribe
	
	const originalDispatch = store.dispatch
	store.dispatch = customDispatch	

	//originalSubscribe(notifyListeners)

	return store

}