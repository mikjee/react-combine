import React, { useMemo, useEffect } from 'react'

import {
	createLayer,
	deleteLayer,
	mountLayer,
	setParent,
	canParent,
	reorderChildren,
	setInputs,
	renameLayer,
	getProjection
} from './core'

import Layer from '../components/Layer'

import { 
	registerMethodHandler, 
	unregisterMethodHandler,
	registerEventHandler,
	unregisterEventHandler,
	callMethod,
	handleEvent
} from './events'

const supportedDOMEvents = {
	onClick: 'click',
	onMouseDown: 'mousedown',
	onMouseUp: 'mouseup',
	onMouseMove: 'mousemove',
	onKeyDown: 'keydown',
	onKeyUp: 'keyup',
	onDoubleClick: 'doubleclick',
	onContextMenu: 'contextmenu',
	onMouseLeave: 'mouseleave',
	onWheel: 'wheel',
}

// TODO: Add other events - input, load etc.

const proxifyLayerState = (globalState, layerId) => {

	if (!globalState.layers[layerId]) return
	let layerObj = { layerId }

	layerObj.effectiveInputs = new Proxy({}, {
		get: (_, input) => globalState.layers[layerId].effectiveInputs[input]
	})

	layerObj.mappedChildren = new Proxy([], {
		get: (_, key) => {
			const children = globalState.layers[layerId].children
			if (children[key]) return children[key]
			else return globalState.layers[layerId].inheritedChildrenMap[key]
		}
	})

	layerObj.layerState = new Proxy({}, {
		get: (_, prop) => globalState.layers[layerId][prop]
	})

	layerObj.layerStates = new Proxy({}, {
		get: (_, id) => globalState.layers[id]
	})

	layerObj.layers = new Proxy({}, {
		get: (_, id) => proxifyLayerState(globalState, id)
	})

	return layerObj
}

export const getPreAPI = (globalState, inject, dispatch) => {

	let preAPI = { inject }

	preAPI.getLayerAPI = layerId => {

		let layerAPI = proxifyLayerState(globalState, layerId)

		layerAPI.Layer = props => <Layer
			{...props}
			preAPI={preAPI}
		/>

		const actions = {
			setInputs: (inputs) => ({ type: 'COMBINE_LAYER_INPUTS', payload: { layerId, inputs } })
		}

		layerAPI.actions = actions
		layerAPI.dispatch = dispatch

		layerAPI.DOMEventHandlers = {}
		Object.keys(supportedDOMEvents).forEach(DOMAttribute => {
			layerAPI.DOMEventHandlers[DOMAttribute] = e => handleEvent(globalState, supportedDOMEvents[DOMAttribute], layerId, e)
		})

		const useMethod = (method, fn) => {
			useMemo(() => registerMethodHandler(layerId, method, fn), [])
			useEffect(() => () => unregisterMethodHandler(layerId, method), [])
		}
		layerAPI.useMethod = useMethod

		if (inject) return inject(layerAPI)
		else return layerAPI

	}

	return preAPI

}

export const getHookAPI = (globalState, layerId) => {

	let hookAPI = proxifyLayerState(globalState, layerId)

	hookAPI.createLayer = (lid, source, inputs, shadows) => createLayer(globalState, {
		layerId: lid,
		creator: layerId,
		type: 'user',
		source,
		inputs,
		shadows
 	})
	hookAPI.deleteLayer = lid => deleteLayer(globalState, lid)	
	hookAPI.setInputs = (lid, inputs, replaceAll, persistShadow) => setInputs(globalState, lid, inputs, replaceAll, persistShadow)
	hookAPI.getProjection = (owner, projectionPath) => getProjection(globalState, owner, projectionPath)
	hookAPI.renameLayer = (lid, newId) => renameLayer(globalState, lid,	newId)

	return hookAPI

}

export const getUserAPI = store => {

	const globalState = new Proxy({}, {
		get: (_,prop) => store.getState()[prop]
	})

	const actions = {
		createLayer: (type, source, parent, inputs, params = {}) => ({ type: 'COMBINE_LAYER_CREATE', payload: { type, source, parent, inputs, ...params } }),

		deleteLayer: (layerId) => ({ type: 'COMBINE_LAYER_DELETE', payload: { layerId } }),

		setParent: (layerId, parent, allowOrphan) => ({ type: 'COMBINE_LAYER_PARENT', payload: { layerId, parent }, allowOrphan }),

		reorderChildren: (children) => ({ type: 'COMBINE_REORDER_CHILDREN', payload: { children } }),

		setInputs: (layerId, inputs) => ({ type: 'COMBINE_LAYER_INPUTS', payload: { layerId, inputs } }),

		setProjectionInputs: (layerId, projectionPath, inputs) => ({ type: 'COMBINE_PROJECTION_INPUTS', payload: { layerId, projectionPath, inputs } }),

		renameLayer: (layerId, newId) => ({ type: 'COMBINE_LAYER_RENAME', payload: { layerId, newId } }),
	}

	const combine = {
		createLayer: (...args) => createLayer(globalState, ...args),
		deleteLayer: (...args) => deleteLayer(globalState, ...args),
		mountLayer: (...args) => mountLayer(globalState, ...args),
		setParent: (...args) => setParent(globalState, ...args),
		canParent: (...args) => canParent(globalState, ...args),
		reorderChildren: (...args) => reorderChildren(globalState, ...args),
		setInputs: (...args) => setInputs(globalState, ...args),
		renameLayer: (...args) => renameLayer(globalState, ...args),
		getProjection: (...args) => getProjection(globalState, ...args)
	}

	const uAPI = {
		layers: new Proxy({}, { get: (_, id) => proxifyLayerState(globalState, id)} ),
		layerStates: new Proxy({}, { get: (_, key) => store.getState().layers[key] }),

		actions,
		store,
		dispatch: store.dispatch,
		combine,

		createLayer: (...args) => store.dispatch(actions.createLayer(...args)),
		deleteLayer: (...args) => store.dispatch(actions.deleteLayer(...args)),
		setParent: (...args) => store.dispatch(actions.setParent(...args)),
		reorderChildren: (...args) => store.dispatch(actions.reorderChildren(...args)),
		setInputs: (...args) => store.dispatch(actions.setInputs(...args)),
		setProjectionInputs: (...args) => store.dispatch(actions.setProjectionInputs(...args)),
		renameLayer: (...args) => store.dispatch(actions.renameLayer(...args)),

		onEvent: registerEventHandler,
		offEvent: unregisterEventHandler,
		callMethod,

		// useReducer: registerUserReducer,
		// stateSlices: new Proxy({}, {
		// 	get: (_, stateSliceKey) => store.getState().stateSlices[stateSliceKey]
		// }),
		
	}

	return uAPI

}