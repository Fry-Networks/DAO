import {
  Table,
  TableHead,
  TableRow,
  TableHeaderCell,
  TableBody,
  TableCell,
  Text,
  Button,
  Callout,
  NumberInput,
  TextInput,
  Flex,
} from '@tremor/react';
import { CheckCircleIcon } from "@heroicons/react/24/solid";
import Modal from 'react-modal';
import { webUser } from '../lib/webusers-model';
import { Product, ProductModel } from '../lib/products-schema';
import { useRef, useState } from 'react';
import ReactModal from 'react-modal';

export default function ProductsTable({ products, updateProducts }: { products: Product[], updateProducts: Function }) {
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [globalMultiplier, setGlobalMultiplier] = useState(1);
  const [updateSuccess, setUpdateSuccess] = useState(""); // State to track update success

  const openEditModal = (product: Product) => {
    setEditingProduct(product);
  };
  const closeModal = () => {
    setEditingProduct(null);
  };
  const unverifiedRewardRef = useRef<HTMLInputElement>(null);
  const verifiedRewardRef = useRef<HTMLInputElement>(null);
  const globalMultiplierRef = useRef<HTMLInputElement>(null);
  const handleSubmit = async (e: any) => {
    e.preventDefault();

    // Ensure editingProduct is not null
    if (!editingProduct) {
      console.error('No product selected for editing');
      return;
    }

    const unverifiedReward = unverifiedRewardRef.current?.value;
    const verifiedReward = verifiedRewardRef.current?.value;

    // Ensure the values are retrieved
    if (unverifiedReward === undefined || verifiedReward === undefined) {
      console.error('Form elements are missing');
      return;
    }

    const updateData = {
      productId: editingProduct.wix_id, // Use the appropriate identifier for the product
      unverifiedReward: unverifiedReward,
      verifiedReward: verifiedReward
    };

    try {
      console.log('Updating product:', editingProduct);

      const response = await fetch('/api/edit-product', { // Replace with your actual API endpoint
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(updateData),
      });

      if (!response.ok) {
        setUpdateSuccess("error"); // Reset success state
        throw new Error(`HTTP error! Status: ${response.status}`);
      }

      const result = await response.json();
      console.log('Updated product:', result);
      updateProducts(); // Update products table
      setUpdateSuccess(editingProduct.name); // Set success state to true
      setTimeout(() => setUpdateSuccess(""), 3000); // Reset success state after 3 seconds
    } catch (err) {
      console.error('Error updating product:', err);
    }

    // Reset editing product and close modal
    setEditingProduct(null);
    closeModal();
  };

  const updateMultiplier = async () => {
    try {
      const response = await fetch('/api/update-multiplier', { // Replace with your actual API endpoint
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ multiplier: globalMultiplier }),
      });

      if (!response.ok) {
        setUpdateSuccess("error"); // Reset success state
        throw new Error(`HTTP error! Status: ${response.status}`);
      }

      const result = await response.json();
      console.log('Updated multiplier:', result);
      setUpdateSuccess("multiplier"); // Set success state to true
      setTimeout(() => setUpdateSuccess(""), 3000); // Reset success state after 3 seconds
    } catch (err) {
      console.error('Error updating multiplier:', err);
    }
  }

  function formatDate(date: Date) {
    date = new Date(date);
    let day = date.getDate().toString().padStart(2, '0');
    let month = (date.getMonth() + 1).toString().padStart(2, '0'); // January is 0
    let year = date.getFullYear();
    let hours = date.getHours().toString().padStart(2, '0');
    let minutes = date.getMinutes().toString().padStart(2, '0');

    return `${day}/${month}/${year} ${hours}:${minutes}`;
  }

  return (
    <div>
      {(updateSuccess != "" && updateSuccess != "error") && (
        <Callout className="mt-4" title="Success" icon={CheckCircleIcon} color="teal">
          Successfully updated {updateSuccess} !
        </Callout>
      )}
      {(updateSuccess == "error") && (
        <Callout className="mt-4" title="Error" icon={CheckCircleIcon} color="red">
          Error updating product!
        </Callout>
      )}
      <Flex flexDirection='row' className="mt-6">
        <NumberInput ref={globalMultiplierRef} defaultValue={globalMultiplier} step={0.01} onChange={(e) => setGlobalMultiplier(+e.target.value)} />
        <Button className="ml-4" onClick={() => {
          updateMultiplier();
        }}>Update multiplier</Button>
        
      </Flex>
      <Table>
        <TableHead>
          <TableRow>
            <TableHeaderCell>Name</TableHeaderCell>
            <TableHeaderCell>Key</TableHeaderCell>
            <TableHeaderCell>Unverified rewards</TableHeaderCell>
            <TableHeaderCell>Verified rewards</TableHeaderCell>
            <TableHeaderCell>Added on </TableHeaderCell>
            <TableHeaderCell>Actions</TableHeaderCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {products.map((product) => (
            <TableRow key={product.wix_id}>
              <TableCell>{product.name}</TableCell>
              <TableCell>
                <Text>{product.key}</Text>
              </TableCell>
              <TableCell>
                <Text>{product.reward.unverified}</Text>
              </TableCell>
              <TableCell>
                <Text>{product.reward.verified}</Text>
              </TableCell>
              <TableCell>
                <Text>{product.created_at ? formatDate(product.created_at) : "Unknown"}</Text>
              </TableCell>
              <TableCell>
                <Button
                  variant="secondary"
                  onClick={() => openEditModal(product)}
                >
                  Edit
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      <Modal
        isOpen={!!editingProduct}
        onRequestClose={closeModal}
        closeTimeoutMS={500}
        style={customStyles}
        contentLabel="Edit Product"
      >
        <h2 className='mb-4'><strong>Editting</strong> {editingProduct?.name} - ({editingProduct?.key})</h2>
        <form onSubmit={handleSubmit}>
          <div className='mb-2'>
            <label>Unverified Reward:</label>
            <NumberInput ref={unverifiedRewardRef} defaultValue={editingProduct?.reward.unverified} step={0.01} />
          </div>
          <div>
            <label>Verified Reward:</label>
            <NumberInput ref={verifiedRewardRef} defaultValue={editingProduct?.reward.verified} step={0.01} />
          </div>
          <div className='mb-4 mt-4'>
            <Button type="submit" className='mr-2' variant="primary">Update</Button>
            <Button onClick={closeModal} variant="secondary">Cancel</Button>
          </div>
        </form>
      </Modal>
    </div>

  );
}


const customStyles = {
  content: {
    top: '50%',
    left: '50%',
    right: 'auto',
    bottom: 'auto',
    marginRight: '-50%',
    transform: 'translate(-50%, -50%)',
    backgroundColor: 'white', // Example background color
    color: "#6b7280",
    padding: '20px',
    borderRadius: '10px',
    boxShadow: '0 4px 8px 0 rgba(0,0,0,0.2)'
  },
  overlay: {
    backgroundColor: 'rgba(0, 0, 0, 0.75)' // Example overlay color
  }
};