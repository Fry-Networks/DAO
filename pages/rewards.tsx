import {
    Card,
    Metric,
    Text,
    Title,
    BarList,
    Flex,
    Grid,
    MultiSelect,
    MultiSelectItem,
    TabPanel,
    TabPanels,
    TabGroup,
    TabList,
    Tab,
    NumberInput
  } from '@tremor/react';
  import Search from '../app/search';
  import clientPromise from '../lib/mongoclient';
  import { useEffect, useRef, useState } from 'react';
  import ProductsTable from '../app/table-products';
  import { getSession } from 'next-auth/react';
  import UserForm from '../components/form-user';
  import RemoveUserForm from '../components/remove-user';
import { Product } from '../lib/products-schema';
  
  export default function RewardsPage() {
    const [products, setProducts] = useState<Product[]>([]);
    const [isInitialLoad, setIsInitialLoad] = useState(true);
    useEffect(() => {
      console.log('Initial load:', isInitialLoad);
      if (isInitialLoad) {
        console.log('Fetching products...');
        fetchProducts();
        setIsInitialLoad(false);
      }
    }, [isInitialLoad]);

    //(VPN|OGPS|IGPS|IDB|ODB)
    const fetchProducts = async () => {
      try {
        const response = await fetch('/api/get-products',{ // Replace with your actual API endpoint
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
          },
        });
        if (!response.ok) {
          throw new Error(`HTTP error! Status: ${response.status}`);
        }
        const data = await response.json();
        setProducts(data);
        
      } catch (error) {
        console.error('Failed to fetch products:', error);
      }
    };
    console.log(products);
    return (
      <main className="p-4 md:p-10 mx-auto max-w-7xl">
        <Title>Wix Products</Title>
        <TabGroup>
          <TabPanels>
            <TabPanel>  
              <Flex flexDirection='row' className="mt-6">
              <div style={{ marginTop: '20px' }}>
                <Text>{products.length} products found!</Text>
              </div>
        
              </Flex>
      
              <Card className="mt-6">
                <ProductsTable products={products} updateProducts={fetchProducts} />
              </Card>
            </TabPanel>
          </TabPanels>
        </TabGroup>
      </main>
    );
  }

  