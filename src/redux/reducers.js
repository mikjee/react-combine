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
} from '../framework/core'

const compositesReducer = (composites = [], action, globalState) => {

	if (action.type === 'COMBINE_ADD_COMPOSITE') {
		return [
			...composites,
			action.payload.layerId
		]
	}

	else if (action.type === 'COMBINE_LAYER_RENAME') {

		if (action.payload.layerId === action.payload.newId) return composites
		if (!action.payload.layerId) return composites
		if (!action.payload.newId) return composites
		if (globalState.layers[action.payload.newId]) return composites

		return composites.map(id => {
			if (id === action.payload.layerId) return action.payload.newId
			else return id
		})

	}

	else return composites

}

const layerReducer = (layers = {}, action, globalState) => {
		
	if (action.type === 'COMBINE_LAYER_INPUTS') {
		setInputs(globalState, action.payload.layerId, action.payload.inputs, action.replaceAll, action.persistShadow)
		return layers
	}

	else if (action.type === 'COMBINE_PROJECTION_INPUTS') {
		const iLayerId = getProjection(globalState, action.payload.layerId, action.payload.projectionPath)
		setInputs(globalState, iLayerId, action.payload.inputs, action.replaceAll, action.persistShadow)
		return layers
	}

	else if (action.type === 'COMBINE_LAYER_PARENT') {
		setParent(globalState, action.payload.layerId, action.payload.parent, action.allowOrphan)
		return layers
	}

	else if (action.type === 'COMBINE_REORDER_CHILDREN') {
		reorderChildren(globalState, action.payload.children)
		return layers
	}

	else if (action.type === 'COMBINE_LAYER_DELETE') {
		deleteLayer(globalState, action.payload.layerId)
		return layers
	}

	else if (action.type === 'COMBINE_LAYER_RENAME') {
		renameLayer(globalState, action.payload.layerId, action.payload.newId)
		return layers
	}

	else if (action.type === 'COMBINE_LAYER_CREATE') {
		createLayer(globalState, {
			creator: action.payload.creator,
			layerId: action.payload.layerId,
			type: action.payload.type, 
			source: action.payload.source, 
			parent: action.payload.parent, 
			inputs: action.payload.inputs, 
			children: action.payload.children,
			shadows: action.payload.shadows
		})

		return layers
	}

	else if (action.type === 'COMBINE_LAYER_MOUNT_ALL') {
		Object.keys(layers).forEach(layerId => mountLayer(globalState, layerId))
		return layers
	}

	else return layers
	
}

// NOTE: Order of execution of reducers is important - composites are updated after layer rename ops
export default {
	composites: compositesReducer,
	layers: layerReducer,	
	//stateSlices: userReducer,
}
