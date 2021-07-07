import _ from "lodash"

import { arrayShallowEqual } from "../misc/helpers"

// Supported hooks - onMount, onInput, onDelete, onRename, onChangeParent, onChangeChildren, canParent
import { getHookAPI } from './API'

let _idCounter = 0
const generateLayerId = (globalState, prefix = 'l') => {	

	while (true) {
		_idCounter ++
		const layerId = prefix + (_idCounter).toString()

		if (globalState.layers[layerId]) continue
		else return layerId
	}

}

const createLayer = (globalState, {
	layerId=false, 
	type='element', 
	source, 
	parent=false, 
	owner=false, 
	inputs={}, 
	children=[], 
	shadows={},
	creator
}) => {
	if (!layerId) {
		let prefix = source

		if (type === 'user') prefix='u'
		else if (type === 'mirror') prefix='l'
		else if (type === 'inherit') prefix='i'

		layerId = generateLayerId(globalState, prefix)
	}

	if (globalState.layers[layerId]) {
		console.warn('Could not create layer - layerId already exists!', layerId)
		return layerId
	}

	globalState.layers[layerId] = { 
		type, 
		source, 
		parent, 
		owner, 
		inputs, 
		children, 
		mirrors: {}, 
		shadows, 
		creator
	}

	if (parent) {
		if (type !== 'inherit') globalState.layers[parent].children = [...globalState.layers[parent].children, layerId]
		Object.keys(globalState.layers[parent].mirrors).forEach(mLayerId => computeInheritedChildren(globalState, mLayerId))
	}
	
	mountLayer(globalState, layerId)

	return layerId
}

const deleteLayer = (globalState, layerId, isRecursing = false) => {

	const layerState = globalState.layers[layerId]
	if (!layerState) return

	// Users cannot delete inherited layers
	if (layerState.type === 'inherit' && !isRecursing) return

	// cannot delete a layer that is a source for other non-inherited layers
	if (!isRecursing) {
		const mirrors = Object.keys(layerState.mirrors)
		for(var i = 0; i < mirrors.length; i++) {
			const type = globalState.layers[mirrors[i]].type
			if (type === 'mirror' || type === 'user') return
		}		
	}

	// Execute hook
	const hook = globalState.elements[layerState.element].onDelete
	if (hook) hook(getHookAPI(globalState, layerId))

	// Remove ourself from mirrors
	if (layerState.type === 'inherit' || layerState.type === 'mirror' || layerState.type === 'user') {
		if (globalState.layers[layerState.source]) delete globalState.layers[layerState.source].mirrors[layerId]
	}

	// Remove ourself from projections
	if (layerState.type === 'inherit' && layerState.owner && globalState.layers[layerState.owner]) {
		delete globalState.layers[layerState.owner].projections[layerState.shadowPath.slice(1).join('/')]
	}

	// Remove ourself from creations
	if (layerState.creator) {
		delete globalState.layers[layerState.creator].creations[layerId]
	}

	// Delete InheritedChildren
	layerState.inheritedChildren.forEach(srcLayerId => {
		const iLayerId = layerState.inheritedChildrenMap[srcLayerId]
		deleteLayer(globalState, iLayerId, true)
	})	

	// Delete Alienated Children
	layerState.children.forEach(childId => deleteLayer(globalState, childId, true))

	// Delete our creations
	Object.keys(layerState.creations).forEach(creationId => deleteLayer(globalState, creationId, true))

	// Remove ourself from parent, and trigger recompute for layers that mirror our parent --- only if we are not recursing because otherwise parent will be getting deleted!
	if (layerState.parent && !isRecursing) {
		globalState.layers[layerState.parent].children = globalState.layers[layerState.parent].children.filter(childId => childId !== layerId)

		Object.keys(globalState.layers[layerState.parent].mirrors).forEach(mLayerId => computeInheritedChildren(
			globalState,
			mLayerId
		))

		// Execute hook
		const cHook = globalState.elements[globalState.layers[layerState.parent].element].onChangeChildren
		if (cHook) cHook(getHookAPI(globalState, layerState.parent), layerId)
	}

	// Delete self
	delete globalState.layers[layerId]
}

const computeEffectiveInputs = (globalState, layerId) => {

	let layerState = globalState.layers[layerId]
	
	if (!layerState.isMounted) mountLayer(globalState, layerId)

	let hasChanged = false
	
	if (layerState.type === 'element') {
		if (!_.isEqual(layerState.effectiveInputs, layerState.inputs)) {
			hasChanged = true
			layerState.effectiveInputs = { ...layerState.inputs }
		}
	}

	else {
		let sourceState = globalState.layers[layerState.source]
		if (!sourceState.isMounted) mountLayer(globalState, layerState.source)

		const newEffectiveInputs = { ...sourceState.effectiveInputs, ...layerState.inputs }
		if (!_.isEqual(layerState.effectiveInputs, newEffectiveInputs)) {
			hasChanged = true
			layerState.effectiveInputs = newEffectiveInputs
		}
	}

	if (hasChanged) {
		Object.keys(layerState.mirrors).forEach(mLayerId => computeEffectiveInputs(globalState, mLayerId))
	}

	// Execute hook
	const hook = globalState.elements[layerState.element].onInput
	if (hook) hook(getHookAPI(globalState, layerId))

}

const computeInheritedChildren = (globalState, layerId) => {

	let layerState = globalState.layers[layerId]
	if (!layerState.isMounted) mountLayer(globalState, layerId)

	if (layerState.type === 'element') {
		if (layerState.inheritedChildren.length !== 0) {

			Object.keys(layerState.inheritedChildrenMap).forEach(srcLayerId => {
				const iLayerId = layerState.inheritedChildrenMap[srcLayerId]
				deleteLayer(globalState, iLayerId, true)
			})

			layerState.inheritedChildren = []
			layerState.inheritedChildrenMap = {}
		}
	}

	else {
		let sourceState = globalState.layers[layerState.source]
		if (!sourceState.isMounted) mountLayer(globalState, layerState.source)
		let hasChanged = false

		let newInheritedChildren = [
			...(sourceState.inheritedChildren).map(srcLayerId => sourceState.inheritedChildrenMap[srcLayerId]), 
			...sourceState.children
		]		
		let newInheritedChildrenMap = {}
		
		newInheritedChildren.forEach(srcLayerId => {
			
			if (layerState.inheritedChildrenMap[srcLayerId]) {
				newInheritedChildrenMap[srcLayerId] = layerState.inheritedChildrenMap[srcLayerId]
			}
			else {
				const iLayerId = createLayer(globalState, {
					type: 'inherit',
					source: srcLayerId,
					parent: layerId,
					owner: layerState.owner || layerId,
					inputs: {},
					children: [],
				})

				newInheritedChildrenMap[srcLayerId] = iLayerId
				hasChanged = true
			}

		})

		layerState.inheritedChildren.forEach(srcLayerId => {
			if (!newInheritedChildrenMap[srcLayerId]) {
				const iLayerId = layerState.inheritedChildrenMap[srcLayerId]
				deleteLayer(globalState, iLayerId, true)				
				hasChanged = true
			}
		})

		if (hasChanged || !arrayShallowEqual(layerState.inheritedChildren, newInheritedChildren)) {
			layerState.inheritedChildren = newInheritedChildren
			layerState.inheritedChildrenMap = newInheritedChildrenMap
		}

	}

	Object.keys(layerState.mirrors).forEach(mLayerId => computeInheritedChildren(globalState, mLayerId))

	// Execute hook
	const hook = globalState.elements[layerState.element].onChangeChildren
	if (hook) hook(getHookAPI(globalState, layerId))

}

const mountLayer = (globalState, layerId, isRecursing) => {
	
	let layerState = globalState.layers[layerId]
	
	if (layerState.isMounted) return
	layerState.isMounted = true
	
	layerState.effectiveInputs = {}
	layerState.inheritedChildren = []
	layerState.inheritedChildrenMap = {}
	layerState.projections = {}
	layerState.mirrors = {}
	layerState.creations = {}

	if (layerState.type === 'element') {
		layerState.element = layerState.source
		layerState.owner = false
		layerState.shadowPath = [layerId]
	}
	else {
		let sourceState = globalState.layers[layerState.source]

		if (!sourceState.isMounted) mountLayer(globalState,	layerState.source)

		layerState.element = sourceState.element
		sourceState.mirrors[layerId] = true
		
		if (layerState.type === 'inherit') {
			layerState.shadowPath = [layerState.owner, ...sourceState.shadowPath]

			let ownerState = globalState.layers[layerState.owner]
			const projectionPath = layerState.shadowPath.slice(1).join('/')
			ownerState.projections[projectionPath] = layerId

			const shadowInputs = ownerState?.shadows[projectionPath]?.inputs
			if (shadowInputs) layerState.inputs = {
				...shadowInputs,
				...layerState.inputs
			}

			const shadowChildren = ownerState?.shadows[projectionPath]?.children
			if (shadowChildren?.length && !layerState.children?.length) {
				layerState.children = shadowChildren
				shadowChildren.forEach(childId => globalState.layers[childId].parent = layerId)
			}
		}
		else layerState.shadowPath = [layerId]

		if (layerState.creator) globalState.layers[layerState.creator].creations[layerId] = true
	}

	computeEffectiveInputs(globalState, layerId)

	computeInheritedChildren(globalState, layerId)

	layerState.children.forEach(childId => mountLayer(globalState, childId,	true))

	// Execute hooks
	const hook = globalState.elements[layerState.element].onMount
	if (hook) hook(getHookAPI(globalState, layerId))

	if (!isRecursing && layerState.parent) {
		const cHook = globalState.elements[globalState.layers[layerState.parent].element].onChangeChildren
		if (cHook) cHook(getHookAPI(globalState, layerState.parent), layerId)
	}

}

const setParent = (globalState, layerId, newParent, allowOrphan) => {

	let layerState = globalState.layers[layerId]
	const oldParent = layerState.parent

	if (oldParent === newParent) return	// sanity
	if (!canParent(globalState, layerId, newParent, allowOrphan)) return

	if (layerState.parent) {
		let oldParentState = globalState.layers[oldParent]
		oldParentState.children = oldParentState.children.filter(childId => childId !== layerId)
		Object.keys(oldParentState.mirrors).forEach(mLayerId => computeInheritedChildren(globalState, mLayerId))
	}

	layerState.parent = newParent

	if (newParent) {
		let newParentState = globalState.layers[newParent]
		newParentState.children = [...newParentState.children ,layerId]
		Object.keys(newParentState.mirrors).forEach(mLayerId => computeInheritedChildren(globalState, mLayerId))
	}

	// Execute hooks
	const hook = globalState.elements[layerState.element].onChangeParent
	if (hook) hook(getHookAPI(globalState, layerId), oldParent)

	if (oldParent) {
		const cHookOldParent = globalState.elements[globalState.layers[oldParent].element].onChangeChildren
		if (cHookOldParent) cHookOldParent(getHookAPI(globalState, oldParent), layerId)
	}

	if (newParent) {
		const cHookNewParent = globalState.elements[globalState.layers[newParent].element].onChangeChildren
		if (cHookNewParent) cHookNewParent(getHookAPI(globalState, newParent), layerId)
	}
	
}

const canParent = (globalState, layerId, newParent, allowOrphan) => {

	if (!newParent) return true
	if (layerId === newParent) return

	const newParentState = globalState.layers[newParent]
	const layerState = globalState.layers[layerId]

	if (layerState.parent === newParent) return	true // sanity
	if (layerState.type === 'inherit') return	// sanity
	if (globalState.layers[newParent].type === "inherit" && !allowOrphan) return // orphans not allowed

	if (newParentState.shadowPath.includes(layerId)) return 
	if (layerState.shadowPath.includes(newParent)) return 

	const isNestedChild = id => {
		if (id === newParent) return true
		for (var i = 0; i < globalState.layers[id].children.length; i ++) {
			if (isNestedChild(globalState.layers[id].children[i])) return true
		}
		return false
	}

	const isDeepInherited = (l1, l2) => {

		// TODO! complete this
		if (globalState.layers[l1].mirrors[l2]) return true
		if (globalState.layers[l2].mirrors[l1]) return true

	}

	if (isNestedChild(layerId)) return 
	if (isDeepInherited(layerId, newParent)) return 

	// Validate from hook
	const hook = globalState.elements[newParentState.element].canParent
	if (hook) {
		if (!hook(getHookAPI(globalState, newParent), layerId)) return
	}

	return true

}

const reorderChildren = (globalState, children) => {

	if (!children.length) return
	const parent = globalState.layers[children[0]]?.parent
	if (!parent) return
	if (globalState.layers[parent]?.children?.length !== children.length) return

	for(var i=0; i < children.length; i++) {
		const childId = children[i]
		if (globalState.layers[childId]?.parent !== parent) return
	}

	globalState.layers[parent].children = [...children]
	Object.keys(globalState.layers[parent].mirrors).forEach(mirrorId => computeInheritedChildren(globalState, mirrorId))

}

const setInputs = (globalState, layerId, inputs, replaceAll, persistShadow) => {

	let layerState = globalState.layers[layerId]

	if (replaceAll === true) layerState.inputs = { ...inputs }
	else {
		layerState.inputs = {
			...layerState.inputs,
			...inputs
		}

		Object.keys(inputs).forEach(input => {
			if (inputs[input] === undefined) delete layerState.inputs[input]
		})
	}

	if (persistShadow && layerState.type === 'inherit') {
		let ownerState = globalState.layers[layerState.owner]		
		if (['element', 'mirror'].includes(ownerState.type)) {
			const projectionPath = layerState.shadowPath.slice(1).join('/')
			if (!ownerState.shadows[projectionPath]) ownerState.shadows[projectionPath] = {}
			ownerState.shadows[projectionPath].inputs = { ...layerState.inputs }
		}
	}

	computeEffectiveInputs(globalState, layerId)

}

const getProjection = (globalState, owner, projectionPath) => {
	return globalState.layers[owner]?.projections[projectionPath]
}

const renameLayer = (globalState, layerId, newId) => {

	if (layerId === newId) return
	if (!layerId) return
	if (!newId) return
	if (globalState.layers[newId]) return

	const fixInheritedLayers = id => {

		let lState = globalState.layers[id]
		const owner = lState.owner

		// update own source
		if (lState.type !== 'element' && lState.source === layerId) lState.source = newId

		// get old projection path
		const oldProjectionPath = lState.shadowPath.slice(1).join('/')		

		// Update own shadowPath
		lState.shadowPath = lState.shadowPath.map(key => key === layerId ? newId : key)
		
		if (owner) {

			// Compute new own shadowPath
			const projectionPath = lState.shadowPath.slice(1).join('/')

			// update self projection on owner
			delete globalState.layers[owner].projections[oldProjectionPath]
			globalState.layers[owner].projections[projectionPath] = id

			// Update self shadows on owner
			const shadows = globalState.layers[owner].shadows[oldProjectionPath]
			delete globalState.layers[owner].shadows[oldProjectionPath]
			globalState.layers[owner].shadows[projectionPath] = shadows
		}

		// recursively update own mirrors
		Object.keys(lState.mirrors).forEach(mId => fixInheritedLayers(mId))

	}

	// move layer
	globalState.layers[newId] = globalState.layers[layerId]
	delete globalState.layers[layerId]
	let layerState = globalState.layers[newId]

	// update own parent
	const parent = layerState.parent
	if (parent) {
		globalState.layers[parent].children = globalState.layers[parent].children.map(childId => childId === layerId ? newId : childId)
	}

	// update own children for new parent
	layerState.children.forEach(childId => globalState.layers[childId].parent = newId)

	// update source layer for new mirror
	if (layerState.type !== 'element') {
		globalState.layers[layerState.source].mirrors[newId] = true
		delete globalState.layers[layerState.source].mirrors[layerId]
	}

	// update own inherited layers
	Object.keys(layerState.projections).forEach(pp => {
		const pId = layerState.projections[pp]
		if (globalState.layers[pId].owner === layerId) globalState.layers[pId].owner = newId
		// TODO: update mirrors of own inheriteds as well?? (change in shadowPath)
		fixInheritedLayers(pId)
	})

	// Update creations
	Object.keys(layerState.creations).forEach(cId => globalState.layers[cId].creator = newId)

	// Update creator
	if (layerState.creator) {
		delete globalState.layers[layerState.creator].creations[layerId]
		globalState.layers[layerState.creator].creations[newId] = true
	}
	
	// Recursively update own mirrors
	fixInheritedLayers(newId)

	// Execute hook
	const hook = globalState.elements[layerState.element].onRename
	if (hook) hook(getHookAPI(globalState, newId), layerId)

	// done
	return true

}

export {
	generateLayerId,
	createLayer,
	deleteLayer,
	mountLayer,
	setParent,
	canParent,
	reorderChildren,
	setInputs,
	getProjection,
	renameLayer
}