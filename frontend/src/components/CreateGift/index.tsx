import React, { useCallback, useContext, useEffect, useState } from "react";
import { createDataTestId } from "../../lib/create-data-testid";
import ipfsClient, {
  // @ts-ignore-next
  urlSource,
} from "ipfs-http-client";
import { darken } from "polished";
import {
  Button,
  VStack,
  Input,
  FormControl,
  FormErrorMessage,
  Box,
  HStack,
  Center,
  Image,
  Heading,
  useClipboard,
  Text,
  FormLabel,
  keyframes,
} from "@chakra-ui/react";
import fileType from "file-type";
import {
  CloseIcon,
  CopyIcon,
  SmallCloseIcon,
  SpinnerIcon,
} from "@chakra-ui/icons";
import { useCreateGiftFormManagement } from "./useCreateGiftFormManagement";
import { useFormik } from "formik";
import graphic from "./graphic.png";
import { BigNumber, ethers } from "ethers";
import {
  CurrentAddressContext,
  ProviderContext,
  SignerContext,
} from "../../hardhat/HardhatContext";
import yGiftDeployment from "../../hardhat/deployments/localhost/yGift.json";
import { Erc20Select, erc20TokensData } from "./Erc20Select";
import { useVideo } from "react-use";
import all from "it-all";
// /src/hardhat/deployments/localhost/yGift.json

export const componentDataTestId = createDataTestId("CreateGift");

const ipfs = ipfsClient({ url: "https://ipfs.infura.io:5001" });
export const params = [
  "_to",
  "_token",
  "_amount",
  "_name",
  "_msg",
  "_url",
  "_start",
] as const;
export const yGiftContractAddress = yGiftDeployment.receipt.contractAddress;
export const erc20Abi = [
  // Some details about the token
  "function name() view returns (string)",
  "function symbol() view returns (string)",

  // Get the account balance
  "function balanceOf(address) view returns (uint)",
  "function approve(address spender, uint256 amount) returns (bool)",

  // Send some of your tokens to someone else
  "function transfer(address to, uint amount)",

  // An event triggered whenever anyone transfers to someone else
  "event Transfer(address indexed from, address indexed to, uint amount)",
  "event Approval(address indexed owner, address indexed spender, uint256 value)",
];

interface IProps {
  isSubmitting?: boolean;
}

const spin = keyframes`
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
`;

interface ISubmittedProps {
  url: string;
  id: string;
}
export const Submitted: React.FC<ISubmittedProps> = (props) => {
  const { hasCopied, onCopy } = useClipboard(props.url);
  const giftIdUrl = `${window.location.href.replace(
    "/create-gift",
    `/gift/${props.id}`
  )}`;
  const { hasCopied: hasIdCopied, onCopy: onIdCopy } = useClipboard(giftIdUrl);
  return (
    <Center
      width={["auto", "auto", "90vw", "1200px"]}
      height={["auto", "auto", "auto", "775px"]}
      {...{
        background:
          "linear-gradient(342.98deg, #013A6D 0%, #0055AC 56.01%, #0065D0 93.35%)",
        borderRadius: "16px",
        py: 8,
      }}
    >
      <VStack spacing={0}>
        <Heading
          as="h3"
          {...{
            fontFamily: "Roboto",
            fontStyle: "normal",
            fontWeight: "bold",
            fontSize: "24px",
            color: "white",
          }}
          mb={"24px"}
        >
          Your gift has been created succesfully
        </Heading>
        <Image src={props.url} width="425px" height="auto" mb={"26px"}></Image>
        <HStack spacing={3} mb={"12px"}>
          <Text
            {...{
              fontFamily: "Roboto",
              fontStyle: "normal",
              fontWeight: "normal",
              fontSize: "16px",
              textOverflow: "ellipsis",
              width: "290px",
              whiteSpace: "nowrap",
              overflow: "hidden",
              color: "white",
            }}
          >
            {props.url}
          </Text>
          {hasCopied ? (
            <Text>Copied</Text>
          ) : (
            <CopyIcon
              color="white"
              id="add"
              cursor="pointer"
              onClick={onCopy}
            ></CopyIcon>
          )}
        </HStack>
        <HStack spacing={3} mb={"24px"}>
          <Text
            {...{
              fontFamily: "Roboto",
              fontStyle: "normal",
              fontWeight: "normal",
              fontSize: "16px",
              textOverflow: "ellipsis",
              width: "290px",
              whiteSpace: "nowrap",
              overflow: "hidden",
              color: "white",
            }}
          >
            {giftIdUrl}
          </Text>
          {hasIdCopied ? (
            <Text>Copied</Text>
          ) : (
            <CopyIcon
              color="white"
              id="add"
              cursor="pointer"
              onClick={onIdCopy}
            ></CopyIcon>
          )}
        </HStack>
        <VStack spacing={1}>
          <Text
            color="white"
            {...{
              fontFamily: "Roboto",
              fontStyle: "normal",
              fontWeight: "bold",
              fontSize: "18px",
              width: "400px",
              textAlign: "center",
            }}
          >
            Want to make this even more memorable?
          </Text>
          <Text
            {...{
              fontFamily: "Roboto",
              fontStyle: "normal",
              fontWeight: "bold",
              fontSize: "18px",
              width: "400px",
              textAlign: "center",
              color: "white",
            }}
          >
            Share the image and URL so that others can add tips with the same
            gifted token.
          </Text>
        </VStack>
      </VStack>
    </Center>
  );
};

export type ValuesOf<T extends readonly any[]> = T[number];

const getPlaceholder = (param: ValuesOf<typeof params>) => {
  switch (param) {
    case "_to": {
      return "To (ETH or ENS address)";
    }
    case "_name": {
      return "Gift Name";
    }
    case "_msg": {
      return "Message";
    }
    case "_amount": {
      return "Gift Amount - (0 is possible)";
    }
    case "_token": {
      return "Token (Contract or ENS) address";
    }
    case "_start": {
      return "Delivery lockup (days to lock tokens for)";
    }
    default: {
      return param;
    }
  }
};

const CreateGift: React.FunctionComponent<IProps> = (props) => {
  const management = useCreateGiftFormManagement();
  const formik = useFormik(management);
  const [provider] = useContext(ProviderContext);
  const [signer] = useContext(SignerContext);
  const [currentAddress] = useContext(CurrentAddressContext);
  const _token = String(formik?.values[Number(params.indexOf("_token"))]);
  const _url = String(formik?.values[Number(params.indexOf("_url"))]);
  const [isApproved, setIsApproved] = useState<boolean>(false);
  const [maxAmount, setMaxAmount] = useState<number>(0);
  const [erc20Contract, setErc20Contract] = useState<
    ethers.Contract | undefined
  >(undefined);
  const [isUploadingCoverImageUrl, setIsUploadingImage] = useState<boolean>(
    false
  );
  const [chosenFile, setChosenFile] = useState<File | undefined>(undefined);
  const [chosenFileUrl, setChosenFileUrl] = useState<string>("");
  const [isVideo, setIsVideo] = useState<boolean>(false);

  // Check if ipfs file is video
  useEffect(() => {
    const fetch = async function () {
      const ipfsFileUrl = _url;
      console.log(ipfsFileUrl);

      if (ipfsFileUrl?.includes("mp4") && !isVideo) {
        setIsVideo(true);
      } else if (ipfsFileUrl?.includes("ipfs") && !isVideo) {
        const [urlSourced] = await all<any>(urlSource(ipfsFileUrl));
        const [file] = await all<ArrayBuffer>(urlSourced.content);
        const fileTypeResult = await fileType.fromBuffer(file);
        const isVideo = Boolean(fileTypeResult?.mime?.includes("video"));
        setIsVideo(isVideo);
      }
    };
    fetch();
  }, [_url, isVideo]);

  useEffect(() => {
    const fetch = async () => {
      // The Contract object
      if (_token === "") {
        setMaxAmount(0);
      }
      // Resolve ens for _token
      const resolvedToken =
        (_token.length > 3 && (await provider?.resolveName(_token))) || _token;
      if (!ethers.utils.isAddress(resolvedToken)) {
        return;
      }
      if (signer && _token) {
        console.log(_token);
        const erc20Contract = new ethers.Contract(
          resolvedToken,
          erc20Abi,
          provider
        ).connect(signer);
        setErc20Contract(erc20Contract);

        const filter = erc20Contract?.filters.Approval(
          currentAddress,
          yGiftContractAddress
        );
        const events = await erc20Contract.queryFilter(filter);
        console.log(events);
        setIsApproved(events?.length > 0);

        if (events?.length > 0) {
          const balance = await erc20Contract.balanceOf(currentAddress);
          console.log(balance?.toString());
          setMaxAmount(balance);
        } else {
          setMaxAmount(0);
        }
      }
    };
    fetch();
  }, [_token, currentAddress, provider, signer]);

  const erc20Approve = useCallback(() => {
    const fetch = async () => {
      if (erc20Contract && signer) {
        erc20Contract.connect(signer);
        const tx = (erc20Contract as any).approve(
          yGiftContractAddress,
          BigNumber.from(2).pow(256).sub(1)
        );
        const approveTx = await tx;
        await approveTx?.wait();
        setIsApproved(true);
        const balance = await erc20Contract.balanceOf(currentAddress);
        console.log(balance?.toString());
        setMaxAmount(balance);
      }
    };

    fetch();
  }, [erc20Contract, signer, currentAddress]);

  async function saveToIpfs(file: File) {
    if (file) {
      setIsUploadingImage(true);
      ipfs
        .add(file, {
          progress: (prog: any) => console.log(`received: ${prog}`),
        })
        .then((file) => {
          console.log(file);
          const ipfsHash = file.path;
          const ipfsGateway = "https://gateway.ipfs.io/ipfs/";
          formik.setFieldValue(
            String(params.indexOf("_url")),
            ipfsGateway + ipfsHash
          );
          setIsUploadingImage(false);
          setChosenFile(undefined);
          setChosenFileUrl("");
        })
        .catch((err) => {
          console.error(err);
        });
      // try {
      //   for (const file of await source) {
      //     console.log(file);
      //   }
      // } catch (err) {
      //   console.error(err);
      // }
    }
  }

  function handleChooseFile(files: FileList) {
    setIsVideo(false);
    const fileExtension = files?.[0]["name"]
      .substring(files?.[0]["name"].lastIndexOf(".") + 1)
      .toLowerCase();

    if (
      files &&
      files[0] &&
      (fileExtension === "gif" ||
        fileExtension === "png" ||
        fileExtension === "jpeg" ||
        fileExtension === "jpg")
    ) {
      setChosenFile(files[0]);
      const reader = new FileReader();

      reader.onload = function (e) {
        if (e?.target?.result) {
          console.log(e.target.result);
          setChosenFileUrl(e.target.result.toString());
        }
      };

      reader.readAsDataURL(files[0]);
    } else if (files && files[0] && fileExtension === "mp4") {
      const reader = new FileReader();
      reader.onload = (e) => {
        var videoElement = document.createElement("video");
        if (e?.target?.result) {
          videoElement.src = String(e.target.result);
          setChosenFileUrl(e.target.result.toString());
        }
      };
      reader.readAsDataURL(files[0]);

      setIsVideo(true);
      setChosenFile(files[0]);
    }
  }

  if (management.hasSubmitted) {
    return (
      <Submitted
        id={management.giftCreatedId}
        url={formik.values?.["5"]}
      ></Submitted>
    );
  }

  return (
    <form onSubmit={formik.handleSubmit}>
      <HStack
        spacing={0}
        {...{
          boxShadow: "0px 0px 68px rgba(27, 39, 70, 0.15)",
          borderRadius: "16px",
          background:
            "linear-gradient(342.98deg, #013A6D 0%, #0055AC 56.01%, #0065D0 93.35%)",
        }}
        width={["auto", "auto", "auto", "1200px"]}
        height={["auto", "auto", "auto", "775px"]}
        flexDirection={["column", "column", "column", "row"]}
        alignItems={["center", "center", "center", "inherit"]}
        mb={8}
      >
        <Center height={"100%"} width={["100%", "100%", "100%", "50%"]}>
          {" "}
          <VStack
            spacing={0}
            py={"36px"}
            height={"100%"}
            alignItems={["center", "center", "center", "inherit"]}
          >
            <Box position="relative">
              {chosenFile?.type?.includes("video") || isVideo ? (
                <video
                  src={
                    formik?.values?.[
                      Number(params?.indexOf("_url"))
                    ]?.toString() || chosenFileUrl
                  }
                  autoPlay
                  playsInline
                  muted
                  loop
                  height="auto"
                  width="464px"
                />
              ) : (
                <Image
                  borderRadius="16px"
                  maxHeight={
                    (chosenFileUrl ||
                      formik.values?.[Number(params.indexOf("_url"))]) &&
                    "463px"
                  }
                  height={
                    ((chosenFileUrl ||
                      formik.values?.[Number(params.indexOf("_url"))]) &&
                      "auto") ||
                    "463px"
                  }
                  maxWidth={
                    ((chosenFileUrl ||
                      formik.values?.[Number(params.indexOf("_url"))]) &&
                      "424px") ||
                    "304px"
                  }
                  src={
                    chosenFileUrl ||
                    formik.values?.[
                      Number(params.indexOf("_url"))
                    ]?.toString() ||
                    graphic
                  }
                  mb={"18px"}
                ></Image>
              )}
              {chosenFileUrl && (
                <Box
                  {...{
                    position: "absolute",
                    display: "flex",
                    justifyContent: "center",
                    alignItems: "center",
                    width: "40px",
                    height: "40px",
                    right: "8px",
                    top: "8px",
                    // background: "#FFFFFF",
                    background: "rgba(255, 255, 255, 0.3)",
                    borderRadius: "32px",
                  }}
                  cursor="pointer"
                  onClick={() => {
                    if (chosenFileUrl.length) {
                      setChosenFile(undefined);
                      setChosenFileUrl("");
                      setIsVideo(false);
                    } else {
                      formik.setFieldValue(String(params.indexOf("_url")), "");
                    }
                  }}
                >
                  <CloseIcon height="12px" width="12px"></CloseIcon>
                </Box>
              )}
            </Box>
            <FormControl
              display={
                formik?.values?.[Number(params.indexOf("_url"))]
                  ? "block"
                  : "none"
              }
              borderRadius="24px"
              key={"_url"}
              isInvalid={Boolean(formik.errors[3] && formik.touched[3])}
              mt={
                ((chosenFileUrl ||
                  formik.values?.[Number(params.indexOf("_url"))]) &&
                  "auto !important") ||
                "inherit"
              }
            >
              <Input
                isRequired
                disabled
                _disabled={{ cursor: "default" }}
                height={"56px"}
                width={"424px"}
                placeholder="Cover URL"
                key={"_url"}
                data-testid={"_url"}
                id={String(params.indexOf("_url"))}
                name={String(params.indexOf("_url"))}
                onChange={formik.handleChange}
                type="text"
                value={formik.values[
                  Number(params.indexOf("_url"))
                ]?.toString()}
                borderRadius={"32px"}
                border="none"
                color="#A1C5E2"
                bg="#336da6"
                {...{
                  fontFamily: "Roboto",
                  fontStyle: "normal",
                  fontWeight: "normal",
                  fontSize: "16px",
                  lineHeight: "137.88%",
                }}
                mb={"32px"}
              />
              <FormErrorMessage>
                {formik.errors[Number(params.indexOf("_url"))]}
              </FormErrorMessage>
            </FormControl>

            {chosenFileUrl.length ? (
              <Button
                variant="outline"
                _hover={{ background: "transparent", border: "1px solid grey" }}
                cursor="pointer"
                {...{
                  fontFamily: "Roboto",
                  fontStyle: "normal",
                  fontWeight: "normal",
                  fontSize: "16px",
                  lineHeight: "137.88%",
                }}
                color="white"
                borderRadius="32px"
                boxSizing="border-box"
                border="1px solid orange"
                borderColor="orange"
                textAlign="center"
                height={"56px"}
                width={"424px"}
                mt={
                  ((chosenFileUrl ||
                    formik.values?.[Number(params.indexOf("_url"))]) &&
                    "inherit") ||
                  "auto"
                }
                m={0}
                onClick={() => {
                  if (chosenFile) {
                    saveToIpfs(chosenFile);
                  }
                }}
              >
                {isUploadingCoverImageUrl ? (
                  <SpinnerIcon
                    color="white"
                    animation={`${spin} 2s infinite linear`}
                  />
                ) : (
                  "Upload File to IPFS"
                )}
              </Button>
            ) : (
              <FormLabel
                display="inline-block"
                cursor="pointer"
                {...{
                  fontFamily: "Roboto",
                  fontStyle: "normal",
                  fontWeight: "normal",
                  fontSize: "16px",
                  lineHeight: "137.88%",
                }}
                color="white"
                borderRadius="32px"
                border="1px solid white"
                textAlign="center"
                height={"56px"}
                width={"424px"}
                m={0}
                mt={
                  ((chosenFileUrl ||
                    formik.values?.[Number(params.indexOf("_url"))]) &&
                    "inherit") ||
                  "auto"
                }
                px={5}
                boxSizing="border-box"
                py={"17px"}
                _hover={{ border: "1px solid grey" }}
              >
                {"Choose Image or mp4"}
                <Input
                  onChange={(event) => {
                    event.stopPropagation();
                    event.preventDefault();
                    if (event.target.files) {
                      return handleChooseFile(event.target.files);
                    }
                  }}
                  display="none"
                  type="file"
                />
              </FormLabel>
            )}
          </VStack>
        </Center>

        <Center
          background="white"
          width={["auto", "auto", "auto", "50%"]}
          height="100%"
          py={[5, 5, 5, 5, 0]}
          px={[5, 5, 5, 5, 20]}
          borderRadius="16px"
          borderTopLeftRadius="none"
          borderBottomLeftRadius="none"
        >
          <VStack spacing={"24px"} width={"420px"}>
            <Heading
              {...{
                fontFamily: "Roboto",
                fontStyle: "normal",
                fontWeight: "bold",
                fontSize: "24px",
                lineHeight: "126.39%",
                color: "#013A6D",
                alignSelf: "flex-start",
              }}
              mt={`0px !important`}
              mb={"8px"}
            >
              Create a new gift
            </Heading>
            <Text
              {...{
                fontFamily: "Roboto",
                fontStyle: "normal",
                fontWeight: "normal",
                fontSize: "16px",
                lineHeight: "137.88%",
                color: "#809EBD",
                textAlign: "left",
                alignSelf: "flex-start",
              }}
              mt={`0px !important`}
              mb={"32px"}
            >
              Add artwork, a special message, and yUSD if you like.
            </Text>
            {params.map((param, index) => {
              if (param === "_url") {
                return null;
              }
              if (param === "_token") {
                return <Erc20Select formik={formik}></Erc20Select>;
              }

              return (
                <FormControl
                  key={param}
                  isInvalid={Boolean(
                    formik.errors[index] && formik.touched[index]
                  )}
                  background="#ECF4FA"
                  borderRadius="24px"
                  mt={index === 0 ? `0px !important` : "inherit"}
                >
                  {maxAmount && param === "_amount" ? (
                    <FormLabel textAlign="center" htmlFor="_amount">
                      {`Max: ${ethers.utils.formatUnits(
                        maxAmount?.toString(),
                        erc20TokensData.find(
                          (token) =>
                            token.address.toLowerCase() ===
                            formik.values[Number(params.indexOf("_token"))]
                              ?.toString()
                              ?.toLowerCase()
                        )?.decimals
                      )}`}
                    </FormLabel>
                  ) : null}
                  <Input
                    isRequired
                    placeholder={getPlaceholder(param)}
                    key={param}
                    data-testid={param}
                    id={index.toString()}
                    name={index.toString()}
                    onChange={formik.handleChange}
                    type={
                      param === "_amount" || param === "_start"
                        ? "number"
                        : "text"
                    }
                    max={
                      param === "_amount"
                        ? ethers.utils
                            .parseUnits(
                              maxAmount?.toString(),
                              erc20TokensData.find(
                                (token) =>
                                  token.address.toLowerCase() ===
                                  formik.values[
                                    Number(params.indexOf("_token"))
                                  ]
                              )?.decimals
                            )
                            .toString()
                        : undefined
                    }
                    min={param === "_amount" ? "0" : undefined}
                    step={param === "_amount" ? "any" : undefined}
                    value={formik.values[index]?.toString()}
                    {...{
                      fontFamily: "Roboto",
                      fontStyle: "normal",
                      fontWeight: "normal",
                      fontSize: "16px",
                      textAlign: "left",
                    }}
                    height={"56px"}
                    width={"424px"}
                    borderRadius="32px"
                  />
                  <FormErrorMessage>{formik.errors[index]}</FormErrorMessage>
                </FormControl>
              );
            })}
            <Button
              data-testid={"submit"}
              type={
                isApproved ||
                formik?.values?.[Number(params.indexOf("_amount"))] === 0
                  ? "submit"
                  : "button"
              }
              onClick={() => {
                !isApproved &&
                  formik?.values?.[Number(params.indexOf("_amount"))] !== 0 &&
                  erc20Approve();
              }}
              isDisabled={!formik.values?.[Number(params.indexOf("_token"))]}
              isLoading={props.isSubmitting || formik.isSubmitting}
              variant="outline"
              background="#0065D0"
              _hover={{ background: darken(0.1, "#0065D0") }}
              borderRadius="32px"
              width={"100%"}
              height={"56px"}
              color="white"
              _disabled={{ background: darken(0.1, "#0065D0") }}
              {...{
                fontFamily: "Roboto",
                fontStyle: "normal",
                fontWeight: "normal",
                fontSize: "16px",
                lineHeight: "137.88%",
              }}
            >
              {isApproved ||
              formik?.values?.[Number(params.indexOf("_amount"))] === 0
                ? "Submit"
                : "Approve"}
            </Button>
          </VStack>
        </Center>
      </HStack>
    </form>
  );
};

export { CreateGift };
