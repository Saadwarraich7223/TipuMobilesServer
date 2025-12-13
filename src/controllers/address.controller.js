import User from "../models/user.model.js";
import Address from "../models/address.model.js";

// Create a new address
export const createAddress = async (req, res) => {
  try {
    const {
      userId,
      fullName,
      phone,
      email,
      addressLine1,
      addressLine2,
      city,
      state,
      postalCode,
      country,
      landmark,
      addressType,
      isDefault,
    } = req.body;

    // Find user by ID
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const newAddress = new Address({
      user: user._id,
      fullName,
      phone,
      email,
      addressLine1,
      addressLine2,
      city,
      state,
      postalCode,
      country,
      landmark,
      addressType,
      isDefault,
    });

    // If it's a default address, update other addresses to set isDefault to false
    if (isDefault) {
      await Address.updateMany({ user: user._id }, { isDefault: false });
    }

    const savedAddress = await newAddress.save();
    res.status(201).json(savedAddress);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Error creating address" });
  }
};

// Get all addresses for a user
export const getAddressesByUser = async (req, res) => {
  try {
    const { userId } = req.params;

    const addresses = await Address.find({ user: userId });
    if (addresses.length === 0) {
      return res
        .status(404)
        .json({ message: "No addresses found for this user" });
    }

    res.status(200).json(addresses);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Error fetching addresses" });
  }
};

// Get a single address by ID
export const getAddressById = async (req, res) => {
  try {
    const { id } = req.params;

    const address = await Address.findById(id);
    if (!address) {
      return res.status(404).json({ message: "Address not found" });
    }

    res.status(200).json(address);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Error fetching address" });
  }
};

// Update an address
export const updateAddress = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      fullName,
      phone,
      email,
      addressLine1,
      addressLine2,
      city,
      state,
      postalCode,
      country,
      landmark,
      addressType,
      isDefault,
    } = req.body;

    // Find the address by ID
    const address = await Address.findById(id);
    if (!address) {
      return res.status(404).json({ message: "Address not found" });
    }

    // If it's a default address, update other addresses to set isDefault to false
    if (isDefault) {
      await Address.updateMany({ user: address.user }, { isDefault: false });
    }
    console.log(city);
    // Update the address
    address.fullName = fullName || address.fullName;
    address.phone = phone || address.phone;
    address.email = email || address.email;
    address.addressLine1 = addressLine1 || address.addressLine1;
    address.addressLine2 = addressLine2 || address.addressLine2;
    address.city = city || address.city;
    address.state = state || address.state;
    address.postalCode = postalCode || address.postalCode;
    address.country = country || address.country;
    address.landmark = landmark || address.landmark;
    address.addressType = addressType || address.addressType;
    address.isDefault = isDefault !== undefined ? isDefault : address.isDefault;

    const updatedAddress = await address.save();
    res.status(200).json(updatedAddress);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Error updating address" });
  }
};

// Delete an address
export const deleteAddress = async (req, res) => {
  try {
    const { id } = req.params;
    const address = await Address.findByIdAndDelete(id);
    if (!address) {
      return res.status(404).json({ message: "Address not found" });
    }

    res.status(200).json({ message: "Address deleted successfully" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Error deleting address" });
  }
};

export const setDefaultAddress = async (req, res) => {
  try {
    const { id } = req.params;
    const address = await Address.findById(id);
    if (!address) {
      return res.status(404).json({ message: "Address not found" });
    }
    await Address.updateMany({ user: address.user }, { isDefault: false });
    address.isDefault = true;
    await address.save();
    res.status(200).json({ message: "Address set as default", address });
  } catch (error) {
    console.error("Error setting default address:" + error);
  }
};
