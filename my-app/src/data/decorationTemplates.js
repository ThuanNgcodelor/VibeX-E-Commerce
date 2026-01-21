export const decorationTemplates = [
    {
        id: 'simple-store',
        name: 'Simple Store',
        description: 'Banner carousel followed by featured products',
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
        name: 'Video Highlight',
        description: 'Video introduction with banner images',
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
        name: 'Rich Content',
        description: 'Complete layout with all widget types',
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
