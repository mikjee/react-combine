import { useMemo } from 'react'
import { useStore } from 'react-redux'

export const useGlobalState = () => {

	const store = useStore()
	const globalState = useMemo(() => new Proxy({}, {
		get: (_, prop) => store.getState()[prop]
	}), [store])

	return globalState

}

export const arrayShallowEqual = (arr1, arr2) => {
	if (arr1 && !arr2) return false
	else if (!arr1 && arr2) return false
	else if (arr1.length !== arr2.length) return false
	else {
		for(var i = 0; i< arr1.length; i++) {
			if (arr1[i] !== arr2[i]) return false
		}
	}
	return true
}