import { useEffect } from 'react'

interface DocumentTitleOptions {
    description?: string
}

export function useDocumentTitle(title: string, options?: DocumentTitleOptions) {
    useEffect(() => {
        const prevTitle = document.title
        const baseTitle = 'UniMarmara'
        document.title = title ? `${title} | ${baseTitle}` : 'UniMarmara - Üniversite Ders & Çalışma Takip Uygulaması'

        let metaDesc = document.querySelector<HTMLMetaElement>('meta[name="description"]')
        const prevDesc = metaDesc ? metaDesc.getAttribute('content') : ''

        if (options?.description) {
            if (!metaDesc) {
                metaDesc = document.createElement('meta')
                metaDesc.setAttribute('name', 'description')
                document.head.appendChild(metaDesc)
            }
            metaDesc.setAttribute('content', options.description)
        }

        return () => {
            document.title = prevTitle
            if (metaDesc && prevDesc !== null && prevDesc !== undefined) {
                metaDesc.setAttribute('content', prevDesc)
            }
        }
    }, [title, options?.description])
}

export default useDocumentTitle
