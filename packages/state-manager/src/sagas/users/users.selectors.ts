import { createSelector } from '@reduxjs/toolkit'
import { getCertFieldValue, getReqFieldValue, keyFromCertificate } from '@quiet/identity'
import { CertFieldsTypes } from './const/certFieldTypes'
import { StoreKeys } from '../store.keys'
import { certificatesAdapter } from './users.adapter'
import { type Certificate } from 'pkijs'
import { type CreatedSelectors, type StoreState } from '../store.types'
import { type UserData, User } from '@quiet/types'

const usersSlice: CreatedSelectors[StoreKeys.Users] = (state: StoreState) => state[StoreKeys.Users]

export const certificates = createSelector(usersSlice, reducerState =>
  certificatesAdapter.getSelectors().selectEntities(reducerState.certificates)
)

export const csrs = createSelector(usersSlice, reducerState =>
  certificatesAdapter.getSelectors().selectEntities(reducerState.csrs)
)

export const certificatesMapping = createSelector(certificates, certs => {
  const mapping: Record<string, UserData> = {}
  Object.keys(certs).map(pubKey => {
    const certificate = certs[pubKey]
    if (!certificate || certificate.subject.typesAndValues.length < 1) {
      return
    }

    const username = getCertFieldValue(certificate, CertFieldsTypes.nickName)
    const onionAddress = getCertFieldValue(certificate, CertFieldsTypes.commonName)
    const peerId = getCertFieldValue(certificate, CertFieldsTypes.peerId)
    const dmPublicKey = getCertFieldValue(certificate, CertFieldsTypes.dmPublicKey) || ''

    if (!username || !onionAddress || !peerId) {
      console.error(`Could not parse certificate for pubkey ${pubKey}`)
      return
    }

    return (mapping[pubKey] = {
      username,
      onionAddress,
      peerId,
      dmPublicKey,
    })
  })
  return mapping
})

export const csrsMapping = createSelector(csrs, csrs => {
  const mapping: Record<string, UserData> = {}

  Object.keys(csrs).map(pubKey => {
    const csr = csrs[pubKey]
    if (!csr || csr.subject.typesAndValues.length < 1) {
      return
    }

    const username = getReqFieldValue(csr, CertFieldsTypes.nickName)
    const onionAddress = getReqFieldValue(csr, CertFieldsTypes.commonName)
    const peerId = getReqFieldValue(csr, CertFieldsTypes.peerId)
    const dmPublicKey = getReqFieldValue(csr, CertFieldsTypes.dmPublicKey) || ''

    if (!username || !onionAddress || !peerId) {
      console.error(`Could not parse certificate for pubkey ${pubKey}`)
      return
    }

    return (mapping[pubKey] = {
      username,
      onionAddress,
      peerId,
      dmPublicKey,
    })
  })

  return mapping
})

export const allUsers = createSelector(csrsMapping, certificatesMapping, (csrs, certs) => {
  const users: Record<string, User> = {}

  const allUsernames: string[] = Object.values(csrs).map(u => u.username)
  const duplicatedUsernames: string[] = allUsernames.filter((val, index) => allUsernames.indexOf(val) !== index)

  // Temporary backward compatiblility! Old communities do not have csrs
  Object.keys(certs).map(pubKey => {
    users[pubKey] = {
      ...certs[pubKey],
      isRegistered: true,
      isDuplicated: false,
      pubKey,
    }
  })

  Object.keys(csrs).map(pubKey => {
    if (users[pubKey]) return
    const username = csrs[pubKey].username

    let isDuplicated: boolean
    if (certs[pubKey]?.username) {
      isDuplicated = false
    } else {
      isDuplicated = duplicatedUsernames.includes(username)
    }

    const isRegistered = Boolean(certs[pubKey])

    users[pubKey] = {
      ...csrs[pubKey],
      isRegistered,
      isDuplicated,
      pubKey,
    }
  })

  return users
})

export const getUserByPubKey = (pubKey: string) => createSelector(allUsers, users => users[pubKey])

export const getOldestParsedCerificate = createSelector(certificates, certs => {
  const getTimestamp = (cert: Certificate) => new Date(cert.notBefore.value).getTime()

  let certificates: { pubkey: string; certificate: Certificate }[] = []

  certificates = Array.from(Object.entries(certs))
    .sort((a, b) => {
      const aTimestamp = getTimestamp(a[1])
      const bTimestamp = getTimestamp(b[1])
      return aTimestamp - bTimestamp
    })
    .map(cert => {
      return {
        pubkey: cert[0],
        certificate: cert[1],
      }
    })
  return certificates[0]
})

export const ownerData = createSelector(getOldestParsedCerificate, ownerCert => {
  if (!ownerCert) return null
  const username = getCertFieldValue(ownerCert.certificate, CertFieldsTypes.nickName)
  const onionAddress = getCertFieldValue(ownerCert.certificate, CertFieldsTypes.commonName)
  const peerId = getCertFieldValue(ownerCert.certificate, CertFieldsTypes.peerId)
  const dmPublicKey = getCertFieldValue(ownerCert.certificate, CertFieldsTypes.dmPublicKey)
  const pubKey = ownerCert.pubkey

  return {
    username,
    onionAddress,
    peerId,
    dmPublicKey,
    pubKey,
  }
})

export const duplicateCerts = createSelector(certificatesMapping, certs => {
  const allUsernames: string[] = Object.values(certs).map(u => u.username)
  const uniqueUsernames = [...new Set(allUsernames)]
  return Boolean(allUsernames.length !== uniqueUsernames.length)
})

export const areCertificatesLoaded = createSelector(
  certificatesMapping,
  certificates => Object.values(certificates).length > 0
)

export const usersSelectors = {
  csrs,
  certificates,
  certificatesMapping,
  csrsMapping,
  getOldestParsedCerificate,
  ownerData,
  allUsers,
  duplicateCerts,
  getUserByPubKey,
  areCertificatesLoaded,
}
