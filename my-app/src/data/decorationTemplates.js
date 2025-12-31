export const decorationTemplates = [
    {
        id: 'simple-store',
        nameKey: 'shopOwner.decoration.templatesList.simpleStore.name',
        descKey: 'shopOwner.decoration.templatesList.simpleStore.desc',
        config: [
            {
                type: 'banner',
                data: { images: [] }
            },
            {
                type: 'products',
                data: { productIds: [], title: 'Featured Products' }
            }
        ]
    },
    {
        id: 'video-highlight',
        nameKey: 'shopOwner.decoration.templatesList.videoHighlight.name',
        descKey: 'shopOwner.decoration.templatesList.videoHighlight.desc',
        config: [
            {
                type: 'video',
                data: { url: '' }
            },
            {
                type: 'products',
                data: { productIds: [], title: 'New Arrivals' }
            }
        ]
    },
    {
        id: 'rich-content',
        nameKey: 'shopOwner.decoration.templatesList.richContent.name',
        descKey: 'shopOwner.decoration.templatesList.richContent.desc',
        config: [
            {
                type: 'banner',
                data: { images: [] }
            },
            {
                type: 'products',
                data: { productIds: [], title: 'Best Sellers' }
            },
            {
                type: 'video',
                data: { url: '' }
            },
            {
                type: 'products',
                data: { productIds: [], title: 'On Sale' }
            }
        ]
    }
];
